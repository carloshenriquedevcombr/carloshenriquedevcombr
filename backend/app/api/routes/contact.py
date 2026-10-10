import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from app.core.config import get_settings
from app.core.rate_limit import build_rate_limiter
from app.core.redis import get_sync_redis
from app.core.security import client_ip, hash_ip
from app.db import get_session
from app.models import ContactMessage
from app.pipeline.bus import bus
from app.pipeline.events import LabEvent
from app.schemas import ContactAck, ContactIn

logger = logging.getLogger("lab.contact")
router = APIRouter(prefix="/contact", tags=["contact"])

_settings = get_settings()
limiter = build_rate_limiter(
    get_sync_redis(), _settings.contact_rate_limit, _settings.contact_rate_window, "rl:contact"
)


@router.post("", response_model=ContactAck, status_code=status.HTTP_202_ACCEPTED)
def send_message(
    payload: ContactIn,
    request: Request,
    session: Session = Depends(get_session),
) -> ContactAck:
    ip_hash = hash_ip(client_ip(request), _settings.ip_hash_salt)

    if not limiter.allow(ip_hash):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas mensagens. Tente novamente mais tarde.",
        )

    # Honeypot preenchido: responde igual a um envio válido para não dar pista ao bot.
    if payload.website:
        logger.info("honeypot acionado", extra={"ip_hash": ip_hash})
        bus.submit(LabEvent("contact", "contact:honeypot", ip_hash))
        return ContactAck()

    session.add(
        ContactMessage(
            name=payload.name,
            email=str(payload.email),
            message=payload.message,
            ip_hash=ip_hash,
        )
    )
    session.commit()
    bus.submit(LabEvent("contact", "contact:message", ip_hash))
    return ContactAck()
