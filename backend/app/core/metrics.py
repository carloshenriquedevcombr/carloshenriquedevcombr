import asyncio
import contextlib
import time
from collections import defaultdict
from typing import Protocol

import redis.asyncio as aioredis
from starlette.types import ASGIApp, Receive, Scope, Send

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


class RequestCounterMiddleware:
    """Conta as requisições HTTP servidas pela API (ASGI puro, não toca no corpo)."""

    def __init__(self, app: ASGIApp, prefix: str = "/api/") -> None:
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"].startswith(self.prefix):
            # Métrica nunca derruba uma requisição (ex.: Redis fora do ar)
            with contextlib.suppress(Exception):
                await metrics.incr("requests_total")
        await self.app(scope, receive, send)


def uptime_seconds() -> int:
    return int(time.time() - STARTED_AT)
