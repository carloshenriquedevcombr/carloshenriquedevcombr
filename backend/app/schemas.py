from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ProjectCategory, SkillGroup


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    summary: str
    category: ProjectCategory
    tags: list[str]
    stack: list[str]
    featured: bool
    status: str
    repo_url: str | None
    demo_url: str | None


class ProjectDetail(ProjectSummary):
    problem: str
    threat_model: str | None
    architecture: str
    implementation: str
    impact: str
    lessons: str | None
    created_at: datetime


class TimelineEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version: str
    title: str
    period: str
    description: str
    highlights: list[str]


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    group: SkillGroup
    evidence: str


class ProfileOut(BaseModel):
    timeline: list[TimelineEntryOut]
    skills: list[SkillOut]


class ContactIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    message: str = Field(min_length=10, max_length=4000)
    # Honeypot: campo invisível no formulário. Humanos deixam vazio; bots preenchem.
    website: str = Field(default="", max_length=200)


class ContactAck(BaseModel):
    status: str = "received"


class HealthOut(BaseModel):
    status: str
    version: str
    database: str


class GitHubStatsOut(BaseModel):
    username: str
    public_repos: int
    followers: int
    last_push_at: str | None
    last_push_repo: str | None


class MetricsOut(BaseModel):
    timestamp: datetime
    uptime_seconds: int
    requests_total: int
    terminal_commands_total: int
    live_connections: int
    projects_total: int
    contact_messages_total: int
    github: GitHubStatsOut | None


class ChallengeOut(BaseModel):
    id: str
    title: str
    category: str
    points: int
    hint: str


class FlagSubmission(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nickname: str = Field(pattern=r"^[A-Za-z0-9_-]{3,24}$")
    flag: str = Field(min_length=1, max_length=100)


class FlagResult(BaseModel):
    correct: bool
    challenge_id: str | None = None
    points: int | None = None
    already_solved: bool = False
    message: str


class HallOfFameEntry(BaseModel):
    nickname: str
    points: int
    solved: list[str]
    last_solve: datetime


class InjectRequest(BaseModel):
    scenario: Literal["traffic", "attack"]
