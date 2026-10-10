"""Mini-CTF do portfólio.

O repositório é público, então as flags não podem estar no código: cada uma é
um HMAC do CTF_SECRET (só existe no servidor). O frontend calcula a flag
"source" com o mesmo segredo e a mesma fórmula.
"""

import hashlib
import hmac
from dataclasses import dataclass

from app.core.config import get_settings


@dataclass(frozen=True)
class Challenge:
    id: str
    title: str
    category: str
    points: int
    hint: str


CHALLENGES = [
    Challenge(
        "headers",
        "Sinais vitais",
        "Recon",
        100,
        "Todo pentest começa pelo reconhecimento. Já checou a saúde da API? Olhe os headers.",
    ),
    Challenge(
        "source",
        "O que não aparece na tela",
        "Web",
        150,
        "Nem tudo que está no HTML é renderizado. Ctrl+U é seu amigo — e base64 também.",
    ),
    Challenge(
        "terminal",
        "Arquivos ocultos",
        "Linux",
        200,
        "No terminal do lab, nem todo arquivo aparece num 'ls' comum. Depois, decodifique.",
    ),
]
CHALLENGE_BY_ID = {c.id: c for c in CHALLENGES}


def flag_for(challenge_id: str) -> str:
    secret = get_settings().ctf_secret.encode()
    digest = hmac.new(secret, challenge_id.encode(), hashlib.sha256).hexdigest()[:12]
    return f"LAB{{{challenge_id}_{digest}}}"


def check_flag(candidate: str) -> Challenge | None:
    candidate = candidate.strip()
    for challenge in CHALLENGES:
        # Comparação em tempo constante: não vaza quantos caracteres acertou
        if hmac.compare_digest(candidate.encode(), flag_for(challenge.id).encode()):
            return challenge
    return None
