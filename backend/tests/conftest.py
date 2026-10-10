import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.routes import ctf as ctf_route
from app.api.routes import metrics as metrics_route
from app.api.routes import pipeline as pipeline_route
from app.api.routes.contact import limiter
from app.core.metrics import metrics
from app.core.ws import connections
from app.db import get_engine
from app.main import app
from app.pipeline.bus import bus
from app.seed.__main__ import DATA_FILE, seed


@pytest.fixture
def engine():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session, json.loads(DATA_FILE.read_text(encoding="utf-8")))
    return engine


@pytest.fixture
def session(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine):
    app.dependency_overrides[get_engine] = lambda: engine
    limiter.reset()
    ctf_route.limiter.reset()
    pipeline_route.inject_limiter.reset()
    bus.reset()
    connections.reset()
    metrics_route.clear_cache()
    asyncio.run(metrics.reset())
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
