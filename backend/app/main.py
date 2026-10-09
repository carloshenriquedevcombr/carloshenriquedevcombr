from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import contact, health, profile, projects
from app.core.config import get_settings
from app.core.security import SecurityHeadersMiddleware

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=(
        "Backend do portfólio **The Lab** — Carlos Henrique.\n\n"
        "Esta documentação é pública de propósito: fique à vontade para chamar os endpoints."
    ),
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

api = APIRouter(prefix="/api/v1")
api.include_router(health.router)
api.include_router(projects.router)
api.include_router(profile.router)
api.include_router(contact.router)
app.include_router(api)
