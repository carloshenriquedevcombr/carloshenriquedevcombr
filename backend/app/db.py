from collections.abc import Iterator

from fastapi import Depends
from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from app.core.config import get_settings

settings = get_settings()

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)


def get_engine() -> Engine:
    return engine


def get_session(engine: Engine = Depends(get_engine)) -> Iterator[Session]:
    with Session(engine) as session:
        yield session
