from fastapi import APIRouter, Depends, HTTPException, Path
from sqlmodel import Session, select

from app.db import get_session
from app.models import Project, ProjectCategory
from app.schemas import ProjectDetail, ProjectSummary

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectSummary])
def list_projects(
    category: ProjectCategory | None = None,
    featured: bool | None = None,
    session: Session = Depends(get_session),
) -> list[Project]:
    stmt = select(Project).order_by(Project.sort_order, Project.id)
    if category is not None:
        stmt = stmt.where(Project.category == category)
    if featured is not None:
        stmt = stmt.where(Project.featured == featured)
    return list(session.exec(stmt))


@router.get("/{slug}", response_model=ProjectDetail)
def get_project(
    slug: str = Path(pattern=r"^[a-z0-9-]{1,80}$"),
    session: Session = Depends(get_session),
) -> Project:
    project = session.exec(select(Project).where(Project.slug == slug)).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project
