import asyncio
import contextlib
import time
from collections import defaultdict
from typing import Protocol

import redis.asyncio as aioredis
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.redis import get_async_redis

STARTED_AT = time.time()


class MetricsStore(Protocol):
    async def incr(self, name: str, amount: int = 1) -> None: ...

    async def get_all(self) -> dict[str, int]: ...

    async def reset(self) -> None: ...


class MemoryMetricsStore:
    def __init__(self) -> None:
        self._counters: dict[str, int] = defaultdict(int)
        self._lock = asyncio.Lock()

    async def incr(self, name: str, amount: int = 1) -> None:
        async with self._lock:
            self._counters[name] += amount

    async def get_all(self) -> dict[str, int]:
        async with self._lock:
            return dict(self._counters)

    async def reset(self) -> None:
        async with self._lock:
            self._counters.clear()


class RedisMetricsStore:
    """Contadores num hash do Redis: somam o tráfego de todas as réplicas."""

    def __init__(self, client: aioredis.Redis, key: str = "lab:metrics") -> None:
        self.client = client
        self.key = key

    async def incr(self, name: str, amount: int = 1) -> None:
        await self.client.hincrby(self.key, name, amount)

    async def get_all(self) -> dict[str, int]:
        raw = await self.client.hgetall(self.key)
        return {k: int(v) for k, v in raw.items()}

    async def reset(self) -> None:
        await self.client.delete(self.key)


def build_metrics_store() -> MetricsStore:
    client = get_async_redis()
    return RedisMetricsStore(client) if client is not None else MemoryMetricsStore()


metrics = build_metrics_store()


class TelemetryMiddleware:
    """Conta as requisições da API e envia cada uma para a pipeline do Data Reactor.

    ASGI puro: não toca no corpo da resposta, só observa status e latência.
    """

    def __init__(self, app: ASGIApp, prefix: str = "/api/") -> None:
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith(self.prefix):
            await self.app(scope, receive, send)
            return

        status_code = 500
        started = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            # Métrica nunca derruba uma requisição (ex.: Redis fora do ar)
            with contextlib.suppress(Exception):
                await metrics.incr("requests_total")
                _emit_http_event(scope, status_code, (time.perf_counter() - started) * 1000)


def _emit_http_event(scope: Scope, status_code: int, latency_ms: float) -> None:
    from app.core.config import get_settings
    from app.core.security import hash_ip
    from app.pipeline.bus import bus
    from app.pipeline.events import LabEvent

    route = scope.get("route")
    # Só o template da rota (ex.: /projects/{slug}) é exibido; caminhos inexistentes
    # viram <404> para não repassar a todos os visitantes um texto enviado por alguém.
    if getattr(route, "path", None):
        path = f"/api/v1{route.path}"
    elif scope["method"] == "OPTIONS":
        path = "(preflight CORS)"  # respondido pelo CORSMiddleware, sem rota
    else:
        path = "<404>"
    client = scope.get("client")
    actor = hash_ip(client[0] if client else "unknown", get_settings().ip_hash_salt)
    bus.submit(
        LabEvent(
            source="http",
            kind=f"{scope['method']} {path}",
            actor=actor,
            status=status_code,
            latency_ms=round(latency_ms, 1),
            detail=scope["path"],
        )
    )


def uptime_seconds() -> int:
    return int(time.time() - STARTED_AT)
