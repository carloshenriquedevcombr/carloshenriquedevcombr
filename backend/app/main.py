import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import contact, ctf, health, metrics, pipeline, profile, projects, terminal
from app.core.config import get_settings
from app.core.metrics import TelemetryMiddleware
from app.core.security import SecurityHeadersMiddleware
from app.pipeline.bus import bus
from app.services import github

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bus.bind(asyncio.get_running_loop())
    task = asyncio.create_task(github.refresh_forever()) if settings.github_username else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=(
        "Backend do portfólio **The Lab** — Carlos Henrique.\n\n"
        "Esta documentação é pública de propósito: fique à vontade para chamar os endpoints.\n\n"
        "WebSockets (não aparecem no Swagger): `/api/v1/terminal/ws` (terminal interativo) "
        "`/api/v1/metrics/ws` (métricas ao vivo, um snapshot a cada 3s) e "
        "`/api/v1/pipeline/ws` (eventos e alertas do Data Reactor)."
    ),
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.add_middleware(TelemetryMiddleware)

api = APIRouter(prefix="/api/v1")
api.include_router(health.router)
api.include_router(projects.router)
api.include_router(profile.router)
api.include_router(contact.router)
api.include_router(metrics.router)
api.include_router(terminal.router)
api.include_router(pipeline.router)
api.include_router(ctf.router)
app.include_router(api)
