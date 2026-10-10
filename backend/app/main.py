import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import contact, health, metrics, profile, projects, terminal
from app.core.config import get_settings
from app.core.metrics import RequestCounterMiddleware
from app.core.security import SecurityHeadersMiddleware
from app.services import github

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
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
        "e `/api/v1/metrics/ws` (métricas ao vivo, um snapshot a cada 3s)."
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
app.add_middleware(RequestCounterMiddleware)

api = APIRouter(prefix="/api/v1")
api.include_router(health.router)
api.include_router(projects.router)
api.include_router(profile.router)
api.include_router(contact.router)
api.include_router(metrics.router)
api.include_router(terminal.router)
app.include_router(api)
