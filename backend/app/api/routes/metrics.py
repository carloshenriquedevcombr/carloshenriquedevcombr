import asyncio
import time
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy import Engine
from sqlmodel import Session, func, select
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.metrics import metrics, uptime_seconds
from app.core.security import hash_ip
from app.core.ws import connections, origin_allowed
from app.db import get_engine
from app.models import ContactMessage, Project
from app.schemas import MetricsOut
from app.services.github import latest_stats

router = APIRouter(prefix="/metrics", tags=["metrics"])

PUSH_INTERVAL = 3.0
_DB_CACHE_TTL = 10.0
_db_cache: tuple[float, dict[str, int]] | None = None


def _db_counts(engine: Engine) -> dict[str, int]:
    # Contagens do banco com cache curto: vários painéis abertos não viram várias queries
    global _db_cache
    now = time.monotonic()
    if _db_cache and now - _db_cache[0] < _DB_CACHE_TTL:
        return _db_cache[1]
    with Session(engine) as session:
        counts = {
            "projects_total": session.exec(select(func.count()).select_from(Project)).one(),
            "contact_messages_total": session.exec(
                select(func.count()).select_from(ContactMessage)
            ).one(),
        }
    _db_cache = (now, counts)
    return counts


def clear_cache() -> None:
    global _db_cache
    _db_cache = None


async def snapshot(engine: Engine) -> MetricsOut:
    counters = await metrics.get_all()
    db = await run_in_threadpool(_db_counts, engine)
    return MetricsOut(
        timestamp=datetime.now(UTC),
        uptime_seconds=uptime_seconds(),
        requests_total=counters.get("requests_total", 0),
        terminal_commands_total=counters.get("terminal_commands_total", 0),
        live_connections=connections.total,
        projects_total=db["projects_total"],
        contact_messages_total=db["contact_messages_total"],
        github=latest_stats(),
    )


@router.get("", response_model=MetricsOut)
async def get_metrics(engine: Engine = Depends(get_engine)) -> MetricsOut:
    return await snapshot(engine)


@router.websocket("/ws")
async def metrics_stream(websocket: WebSocket, engine: Engine = Depends(get_engine)) -> None:
    """Envia um snapshot das métricas a cada 3 segundos."""
    if not origin_allowed(websocket):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    ip = websocket.client.host if websocket.client else "unknown"
    ip_key = hash_ip(ip, get_settings().ip_hash_salt)
    if not connections.acquire(ip_key):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="too many connections")
        return

    async def push() -> None:
        while True:
            data = await snapshot(engine)
            await websocket.send_text(data.model_dump_json())
            await asyncio.sleep(PUSH_INTERVAL)

    pusher: asyncio.Task | None = None
    try:
        await websocket.accept()
        pusher = asyncio.create_task(push())
        # O cliente não envia nada; ler o socket serve para detectar a desconexão
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if pusher:
            pusher.cancel()
        connections.release(ip_key)
