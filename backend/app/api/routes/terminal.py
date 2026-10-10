import asyncio
import logging
from dataclasses import asdict

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy import Engine
from sqlmodel import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.metrics import metrics
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.security import hash_ip
from app.core.ws import connections, origin_allowed
from app.db import get_engine
from app.terminal import commands

logger = logging.getLogger("lab.terminal")
router = APIRouter(tags=["terminal"])

BANNER = [
    commands.Line("LAB-OS 2.0 · conexão estabelecida via WebSocket", "accent"),
    commands.Line("Sandbox: cada comando é uma função Python numa allowlist — sem shell.", "muted"),
    commands.Line("Digite 'help' para começar.", "muted"),
]


def _execute(raw: str, engine: Engine, stats: dict[str, int]) -> commands.Reply:
    with Session(engine) as session:
        return commands.run(raw, commands.Context(session=session, stats=stats))


def _payload(reply: commands.Reply) -> dict:
    return {
        "type": "output",
        "lines": [asdict(line) for line in reply.lines],
        "event": reply.event,
    }


@router.websocket("/terminal/ws")
async def terminal(websocket: WebSocket, engine: Engine = Depends(get_engine)) -> None:
    settings = get_settings()
    if not origin_allowed(websocket):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    ip = websocket.client.host if websocket.client else "unknown"
    ip_key = hash_ip(ip, settings.ip_hash_salt)
    if not connections.acquire(ip_key):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="too many connections")
        return

    # Rate limit por conexão: um cliente não consegue inundar a API de comandos
    limiter = SlidingWindowRateLimiter(settings.terminal_rate_limit, settings.terminal_rate_window)
    try:
        await websocket.accept()
        await websocket.send_json(_payload(commands.Reply(lines=list(BANNER))))
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=settings.terminal_idle_timeout
                )
            except TimeoutError:
                await websocket.close(code=status.WS_1000_NORMAL_CLOSURE, reason="idle timeout")
                return

            if len(raw) > settings.terminal_max_message:
                limit = settings.terminal_max_message
                reply = commands.Reply().out(f"entrada muito longa (máx. {limit} chars)", "error")
            elif not limiter.allow("conn"):
                reply = commands.Reply().out(
                    "rate limit: calma, hacker. Aguarde alguns segundos.", "error"
                )
            else:
                await metrics.incr("terminal_commands_total")
                stats = await metrics.get_all()
                reply = await run_in_threadpool(_execute, raw, engine, stats)
            await websocket.send_json(_payload(reply))
    except WebSocketDisconnect:
        pass
    finally:
        connections.release(ip_key)
