import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.routes.contact import limiter
from app.db import get_session
from app.main import app
from app.seed.__main__ import DATA_FILE, seed


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session, json.loads(DATA_FILE.read_text(encoding="utf-8")))
        yield session


@pytest.fixture
def client(session):
    app.dependency_overrides[get_session] = lambda: session
    limiter.reset()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
