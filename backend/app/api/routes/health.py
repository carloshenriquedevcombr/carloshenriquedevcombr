from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session

from app import __version__
from app.ctf import flag_for
from app.db import get_session
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.api_route("/health", methods=["GET", "HEAD"], response_model=HealthOut)
def health(response: Response, session: Session = Depends(get_session)) -> HealthOut:
    try:
        session.exec(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "unavailable"
    status = "ok" if database == "ok" else "degraded"
    # CTF #1 (Recon): quem inspeciona os headers encontra a flag
    response.headers["X-Lab-Flag"] = flag_for("headers")
    return HealthOut(status=status, version=__version__, database=database)
