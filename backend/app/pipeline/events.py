import itertools
import time
from dataclasses import dataclass, field
from typing import Literal

Source = Literal["http", "terminal", "contact", "ctf"]
Severity = Literal["low", "medium", "high"]

_ids = itertools.count(1)


@dataclass
class LabEvent:
    """Evento bruto que entra na pipeline (estágio Extract).

    `actor` é o hash do IP: serve para correlacionar eventos na detecção e
    NUNCA é enviado aos clientes. `detail` também é privado (ex.: o comando
    digitado) — só regras de detecção o leem.
    """

    source: Source
    kind: str
    actor: str
    status: int | None = None
    latency_ms: float | None = None
    detail: str = ""
    synthetic: bool = False
    ts: float = field(default_factory=time.time)
    id: int = field(default_factory=lambda: next(_ids))

    def public(self, malicious: bool) -> dict:
        return {
            "id": self.id,
            "ts": self.ts,
            "source": self.source,
            "kind": self.kind,
            "status": self.status,
            "latency_ms": self.latency_ms,
            "malicious": malicious,
            "synthetic": self.synthetic,
        }


@dataclass
class Alert:
    rule: str
    title: str
    severity: Severity
    technique: str | None  # ID do MITRE ATT&CK
    synthetic: bool
    ts: float = field(default_factory=time.time)
    id: int = field(default_factory=lambda: next(_ids))

    def public(self) -> dict:
        return {
            "id": self.id,
            "ts": self.ts,
            "rule": self.rule,
            "title": self.title,
            "severity": self.severity,
            "technique": self.technique,
            "synthetic": self.synthetic,
        }
