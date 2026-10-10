"""Coleta periódica de estatísticas públicas do GitHub para o Live Metrics.

Roda como tarefa de fundo (sem token: a API pública permite 60 req/h por IP,
e usamos 2 a cada `github_refresh_seconds`). Se falhar, mantém o último valor.
"""

import asyncio
import logging
from dataclasses import asdict, dataclass

import httpx

from app.core.config import get_settings

logger = logging.getLogger("lab.github")


@dataclass
class GitHubStats:
    username: str
    public_repos: int
    followers: int
    last_push_at: str | None
    last_push_repo: str | None


_latest: GitHubStats | None = None


def latest_stats() -> dict | None:
    return asdict(_latest) if _latest else None


async def fetch_stats(client: httpx.AsyncClient, username: str) -> GitHubStats:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "the-lab-portfolio"}
    user = await client.get(f"https://api.github.com/users/{username}", headers=headers)
    user.raise_for_status()
    events = await client.get(
        f"https://api.github.com/users/{username}/events/public",
        params={"per_page": 30},
        headers=headers,
    )
    events.raise_for_status()
    push = next((e for e in events.json() if e.get("type") == "PushEvent"), None)
    data = user.json()
    return GitHubStats(
        username=username,
        public_repos=data.get("public_repos", 0),
        followers=data.get("followers", 0),
        last_push_at=push["created_at"] if push else None,
        last_push_repo=push["repo"]["name"] if push else None,
    )


async def refresh_forever() -> None:
    global _latest
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            try:
                _latest = await fetch_stats(client, settings.github_username)
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                logger.warning("falha ao atualizar estatísticas do GitHub: %s", exc)
            await asyncio.sleep(settings.github_refresh_seconds)
