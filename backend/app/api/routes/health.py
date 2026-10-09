from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session

from app import __version__
from app.db import get_session
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(session: Session = Depends(get_session)) -> HealthOut:
    try:
        session.exec(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "unavailable"
    status = "ok" if database == "ok" else "degraded"
    return HealthOut(status=status, version=__version__, database=database)
