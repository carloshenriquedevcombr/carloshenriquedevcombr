from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import Skill, TimelineEntry
from app.schemas import ProfileOut, SkillOut, TimelineEntryOut

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(session: Session = Depends(get_session)) -> ProfileOut:
    timeline = session.exec(select(TimelineEntry).order_by(TimelineEntry.sort_order))
    skills = session.exec(select(Skill).order_by(Skill.group, Skill.sort_order))
    return ProfileOut(
        timeline=[TimelineEntryOut.model_validate(t) for t in timeline],
        skills=[SkillOut.model_validate(s) for s in skills],
    )
