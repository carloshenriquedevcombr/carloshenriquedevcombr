"""Motor de detecção (o "SIEM" do Data Reactor).

Regras simples, no estilo Sigma: cada uma olha um evento (e, quando precisa,
uma janela de eventos do mesmo ator) e decide se gera um alerta. Cada regra
aponta para a técnica correspondente do MITRE ATT&CK.
"""

import re
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass

from app.pipeline.events import Alert, LabEvent, Severity

INJECTION = re.compile(r"[;|`&<>]|\$\(|\b(bash|sh|nc|wget|curl|python|perl)\b")
TRAVERSAL = re.compile(r"\.\./|/etc/(passwd|shadow)")

COOLDOWN = 30  # segundos sem repetir o mesmo alerta para o mesmo ator


@dataclass
class Rule:
    id: str
    title: str
    severity: Severity
    technique: str | None
    match: Callable[[LabEvent, "Detector"], bool]


class Detector:
    def __init__(self) -> None:
        self._windows: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._last_alert: dict[tuple[str, str], float] = {}

    def count_in_window(self, key: str, actor: str, window: float, now: float) -> int:
        """Registra uma ocorrência e devolve quantas houve na janela."""
        hits = self._windows[(key, actor)]
        hits.append(now)
        while hits and now - hits[0] > window:
            hits.popleft()
        return len(hits)

    def analyze(self, event: LabEvent) -> list[Alert]:
        alerts = []
        now = time.time()
        for rule in RULES:
            if not rule.match(event, self):
                continue
            key = (rule.id, event.actor)
            if now - self._last_alert.get(key, 0) < COOLDOWN:
                continue
            self._last_alert[key] = now
            alerts.append(
                Alert(
                    rule=rule.id,
                    title=rule.title,
                    severity=rule.severity,
                    technique=rule.technique,
                    synthetic=event.synthetic,
                )
            )
        return alerts

    def reset(self) -> None:
        self._windows.clear()
        self._last_alert.clear()


def _terminal_injection(e: LabEvent, d: Detector) -> bool:
    return e.source == "terminal" and bool(INJECTION.search(e.detail))


def _traversal(e: LabEvent, d: Detector) -> bool:
    return bool(TRAVERSAL.search(e.detail))


def _scan_out_of_scope(e: LabEvent, d: Detector) -> bool:
    if e.source != "terminal" or e.kind != "cmd:nmap":
        return False
    from app.terminal.commands import nmap_in_scope

    return not nmap_in_scope(e.detail.split()[1:])


def _priv_escalation(e: LabEvent, d: Detector) -> bool:
    return e.kind == "cmd:sudo" and "hire carlos" not in e.detail


def _enumeration(e: LabEvent, d: Detector) -> bool:
    if e.source != "http" or e.status != 404:
        return False
    return d.count_in_window("404", e.actor, 60, e.ts) >= 5


def _flag_bruteforce(e: LabEvent, d: Detector) -> bool:
    if e.source != "ctf" or e.kind != "ctf:wrong":
        return False
    return d.count_in_window("ctf-wrong", e.actor, 60, e.ts) >= 5


def _honeypot(e: LabEvent, d: Detector) -> bool:
    return e.source == "contact" and e.kind == "contact:honeypot"


def _rate_limited(e: LabEvent, d: Detector) -> bool:
    return e.status == 429 or e.kind == "rate-limited"


RULES = [
    Rule("LAB-001", "Tentativa de injeção de comando", "high", "T1059", _terminal_injection),
    Rule("LAB-002", "Path traversal / leitura de arquivo sensível", "high", "T1083", _traversal),
    Rule("LAB-003", "Varredura de rede fora do escopo", "medium", "T1046", _scan_out_of_scope),
    Rule("LAB-004", "Tentativa de escalonamento de privilégio", "low", "T1548", _priv_escalation),
    Rule("LAB-005", "Enumeração de recursos (rajada de 404)", "medium", "T1595.003", _enumeration),
    Rule("LAB-006", "Brute force de flags do CTF", "medium", "T1110", _flag_bruteforce),
    Rule("LAB-007", "Bot capturado pelo honeypot", "low", None, _honeypot),
    Rule("LAB-008", "Rate limit excedido", "low", "T1499", _rate_limited),
]
