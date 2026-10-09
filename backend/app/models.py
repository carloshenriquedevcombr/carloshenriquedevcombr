from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class ProjectCategory(StrEnum):
    """Tags de operação usadas para filtrar o Projects Lab."""

    automation = "automation"
    data = "data"
    blue_team = "blue_team"
    red_team = "red_team"
    purple_team = "purple_team"
    hardware = "hardware"
    backend = "backend"
    infra = "infra"


class SkillGroup(StrEnum):
    backend_automation = "backend_automation"
    data_engineering = "data_engineering"
    cybersecurity = "cybersecurity"
    infrastructure = "infrastructure"
    hardware = "hardware"


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(index=True, unique=True, max_length=80)
    title: str = Field(max_length=120)
    summary: str = Field(max_length=300)
    category: ProjectCategory = Field(index=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    stack: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))

    # Estudo de caso no formato de relatório de engenharia
    problem: str
    threat_model: str | None = None
    architecture: str
    implementation: str
    impact: str
    lessons: str | None = None

    repo_url: str | None = None
    demo_url: str | None = None
    featured: bool = Field(default=False, index=True)
    sort_order: int = Field(default=0)
    status: str = Field(default="in_progress", max_length=20)
    created_at: datetime = Field(default_factory=utcnow)


class TimelineEntry(SQLModel, table=True):
    """Uma 'versão' na história de transição (o Changelog)."""

    id: int | None = Field(default=None, primary_key=True)
    version: str = Field(max_length=10)
    title: str = Field(max_length=120)
    period: str = Field(max_length=40)
    description: str
    highlights: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    sort_order: int = Field(default=0)


class Skill(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=60)
    group: SkillGroup = Field(index=True)
    # Evidência concreta (projeto, certificação, uso em produção) — nada de barras de %
    evidence: str = Field(max_length=200)
    sort_order: int = Field(default=0)


class ContactMessage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    email: str = Field(max_length=254)
    message: str = Field(max_length=4000)
    ip_hash: str = Field(max_length=64, index=True)
    created_at: datetime = Field(default_factory=utcnow)
