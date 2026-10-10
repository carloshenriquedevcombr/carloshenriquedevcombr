"""Cenários sintéticos para o botão "Inject Anomaly" / "Gerar tráfego".

Os eventos são marcados como synthetic=True e passam pelo MESMO motor de
detecção do tráfego real — é uma demonstração das regras, não uma animação.
"""

import asyncio
import secrets
import uuid

from app.pipeline.bus import bus
from app.pipeline.events import LabEvent

_ROUTES = ["/api/v1/projects", "/api/v1/profile", "/api/v1/health", "/api/v1/metrics"]
_PROBES = ["/.env", "/wp-admin", "/phpmyadmin", "/.git/config", "/admin.php", "/backup.zip"]


def _latency() -> float:
    return round(4 + secrets.randbelow(400) / 10, 1)


def _traffic(actor: str) -> list[LabEvent]:
    events = []
    for i in range(18):
        route = _ROUTES[i % len(_ROUTES)]
        events.append(LabEvent("http", f"GET {route}", actor, 200, _latency(), synthetic=True))
        if i % 5 == 0:
            cmd = ["whoami", "help", "nmap lab.local", "skills"][i // 5 % 4]
            events.append(
                LabEvent("terminal", f"cmd:{cmd.split()[0]}", actor, detail=cmd, synthetic=True)
            )
    return events


def _attack(actor: str) -> list[LabEvent]:
    events = [
        LabEvent("http", f"GET {path}", actor, 404, _latency(), synthetic=True) for path in _PROBES
    ]
    events += [
        LabEvent("terminal", "cmd:nmap", actor, detail="nmap 10.0.0.0/8", synthetic=True),
        LabEvent("terminal", "cmd:cat", actor, detail="cat ../../etc/passwd; id", synthetic=True),
        LabEvent("terminal", "cmd:sudo", actor, detail="sudo su", synthetic=True),
    ]
    events += [
        LabEvent("ctf", "ctf:wrong", actor, detail="LAB{guess}", synthetic=True) for _ in range(5)
    ]
    events.append(LabEvent("http", "POST /api/v1/contact", actor, 429, _latency(), synthetic=True))
    return events


SCENARIOS = {"traffic": _traffic, "attack": _attack}
MAX_RUNNING = 3
_running: set[asyncio.Task] = set()


async def _play(events: list[LabEvent]) -> None:
    for event in events:
        await bus.ingest(event)
        await asyncio.sleep(0.12)


def start(scenario: str) -> bool:
    """Dispara um cenário em segundo plano. False se já há cenários demais rodando."""
    if len(_running) >= MAX_RUNNING:
        return False
    actor = f"synthetic:{uuid.uuid4().hex[:8]}"
    task = asyncio.get_running_loop().create_task(_play(SCENARIOS[scenario](actor)))
    _running.add(task)
    task.add_done_callback(_running.discard)
    return True
