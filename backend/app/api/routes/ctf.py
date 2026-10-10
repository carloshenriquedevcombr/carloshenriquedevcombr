from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.rate_limit import build_rate_limiter
from app.core.redis import get_sync_redis
from app.core.security import client_ip, hash_ip
from app.ctf import CHALLENGE_BY_ID, CHALLENGES, check_flag
from app.db import get_session
from app.models import CtfSolve
from app.pipeline.bus import bus
from app.pipeline.events import LabEvent
from app.schemas import ChallengeOut, FlagResult, FlagSubmission, HallOfFameEntry

router = APIRouter(prefix="/ctf", tags=["ctf"])

# Freia brute force: 10 tentativas a cada 10 minutos por IP
limiter = build_rate_limiter(get_sync_redis(), 10, 600, "rl:ctf")


@router.get("/challenges", response_model=list[ChallengeOut])
def list_challenges() -> list[ChallengeOut]:
    return [ChallengeOut(**c.__dict__) for c in CHALLENGES]


@router.post("/submit", response_model=FlagResult)
def submit_flag(
    payload: FlagSubmission,
    request: Request,
    session: Session = Depends(get_session),
) -> FlagResult:
    actor = hash_ip(client_ip(request), get_settings().ip_hash_salt)
    if not limiter.allow(actor):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Volte em alguns minutos.",
        )

    challenge = check_flag(payload.flag)
    if challenge is None:
        bus.submit(LabEvent("ctf", "ctf:wrong", actor, detail=payload.flag[:60]))
        return FlagResult(correct=False, message="Flag incorreta. Continue tentando!")

    bus.submit(LabEvent("ctf", "ctf:solve", actor))
    session.add(CtfSolve(nickname=payload.nickname, challenge_id=challenge.id))
    try:
        session.commit()
        already = False
    except IntegrityError:
        session.rollback()
        already = True
    return FlagResult(
        correct=True,
        challenge_id=challenge.id,
        points=challenge.points,
        already_solved=already,
        message=(
            f"Você já tinha resolvido '{challenge.title}'."
            if already
            else f"Flag válida! +{challenge.points} pontos em '{challenge.title}'."
        ),
    )


@router.get("/hall-of-fame", response_model=list[HallOfFameEntry])
def hall_of_fame(session: Session = Depends(get_session)) -> list[HallOfFameEntry]:
    solves = session.exec(select(CtfSolve).order_by(CtfSolve.solved_at)).all()
    board: dict[str, HallOfFameEntry] = {}
    for s in solves:
        entry = board.setdefault(
            s.nickname,
            HallOfFameEntry(nickname=s.nickname, points=0, solved=[], last_solve=s.solved_at),
        )
        entry.points += CHALLENGE_BY_ID[s.challenge_id].points
        entry.solved.append(s.challenge_id)
        entry.last_solve = s.solved_at
    # Mais pontos primeiro; empate: quem chegou antes
    ranking = sorted(board.values(), key=lambda e: (-e.points, e.last_solve))
    return ranking[:20]
