import asyncio

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, status

from app.core.config import get_settings
from app.core.metrics import metrics
from app.core.rate_limit import build_rate_limiter
from app.core.redis import get_sync_redis
from app.core.security import client_ip, hash_ip
from app.core.ws import connections, origin_allowed
from app.pipeline import simulator
from app.pipeline.bus import bus
from app.schemas import InjectRequest

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

inject_limiter = build_rate_limiter(get_sync_redis(), 4, 60, "rl:inject")

STAT_KEYS = [
    "pipeline_extracted",
    "pipeline_transformed",
    "pipeline_loaded",
    "pipeline_blocked",
    "pipeline_alerts",
]


async def _stats() -> dict[str, int]:
    counters = await metrics.get_all()
    return {key.removeprefix("pipeline_"): counters.get(key, 0) for key in STAT_KEYS}


@router.get("/stats")
async def pipeline_stats() -> dict:
    return {
        "stats": await _stats(),
        "events": list(bus.recent_events),
        "alerts": list(bus.recent_alerts),
    }


@router.post("/inject", status_code=status.HTTP_202_ACCEPTED)
async def inject(payload: InjectRequest, request: Request) -> dict:
    """Dispara um cenário sintético (tráfego normal ou ataque) pela pipeline real."""
    actor = hash_ip(client_ip(request), get_settings().ip_hash_salt)
    if not inject_limiter.allow(actor) or not simulator.start(payload.scenario):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="O reator está ocupado. Tente de novo em instantes.",
        )
    return {"status": "injecting", "scenario": payload.scenario}


@router.websocket("/ws")
async def pipeline_stream(websocket: WebSocket) -> None:
    """Snapshot inicial + cada evento e alerta da pipeline em tempo real."""
    if not origin_allowed(websocket):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    ip = websocket.client.host if websocket.client else "unknown"
    ip_key = hash_ip(ip, get_settings().ip_hash_salt)
    if not connections.acquire(ip_key):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="too many connections")
        return

    queue = bus.subscribe()

    async def forward() -> None:
        while True:
            message = await queue.get()
            if message["type"] == "event":
                message["stats"] = await _stats()
            await websocket.send_json(message)

    forwarder: asyncio.Task | None = None
    try:
        await websocket.accept()
        await websocket.send_json(
            {
                "type": "hello",
                "stats": await _stats(),
                "events": list(bus.recent_events),
                "alerts": list(bus.recent_alerts),
            }
        )
        forwarder = asyncio.create_task(forward())
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if forwarder:
            forwarder.cancel()
        bus.unsubscribe(queue)
        connections.release(ip_key)
