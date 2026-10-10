from contextlib import ExitStack

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings

WS = "/api/v1/terminal/ws"


def send(ws, cmd: str) -> dict:
    ws.send_text(cmd)
    return ws.receive_json()


def texts(msg: dict) -> str:
    return "\n".join(line["text"] for line in msg["lines"])


def test_banner_on_connect(client):
    with client.websocket_connect(WS) as ws:
        banner = ws.receive_json()
        assert banner["type"] == "output"
        assert "allowlist" in texts(banner)


def test_help_lists_public_commands_only(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        out = texts(send(ws, "help"))
        assert "nmap" in out and "mode" in out
        assert "sudo" not in out  # easter eggs não aparecem no help


def test_unknown_command(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        msg = send(ws, "bash -i")
        assert "command not found" in texts(msg)
        assert msg["lines"][0]["style"] == "error"


@pytest.mark.parametrize("cmd", ["rm -rf /", "rm -rf / --no-preserve-root"])
def test_destructive_commands_are_harmless(client, cmd):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert "sandbox" in texts(send(ws, cmd))


def test_shell_metacharacters_are_not_interpreted(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert "command not found" in texts(send(ws, "$(whoami); cat /etc/passwd"))
        assert "não foi possível" in texts(send(ws, "ls /etc"))


def test_nmap_emits_scan_event(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        msg = send(ws, "nmap lab.local")
        assert msg["event"]["type"] == "scan"
        assert msg["event"]["hosts"] == ["gw", "web", "api", "db", "cache"]
        assert "filtered" in texts(msg)


def test_nmap_out_of_scope(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        msg = send(ws, "nmap 8.8.8.8")
        assert msg["event"] is None
        assert "fora do escopo" in texts(msg)


def test_mode_events(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert send(ws, "mode red")["event"] == {"type": "mode", "mode": "red"}
        assert send(ws, "mode rainbow")["event"] is None


def test_project_commands_read_from_database(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert "the-lab-portfolio" in texts(send(ws, "ls projects"))
        assert "/projects/the-lab-portfolio" in texts(send(ws, "cat the-lab-portfolio"))
        assert "não encontrado" in texts(send(ws, "cat ../../etc/passwd"))


def test_sudo_easter_egg(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert send(ws, "sudo hire carlos")["event"] == {"type": "navigate", "href": "/#contato"}
        assert "sudoers" in texts(send(ws, "sudo su"))


def test_long_input_rejected(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert "muito longa" in texts(send(ws, "a" * 600))


def test_rate_limit_per_connection(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        outputs = [texts(send(ws, "whoami")) for _ in range(16)]
        assert "rate limit" not in outputs[14]
        assert "rate limit" in outputs[15]


def test_foreign_origin_is_rejected(client):
    h = {"origin": "https://evil.example"}
    with pytest.raises(WebSocketDisconnect) as exc, client.websocket_connect(WS, headers=h) as ws:
        ws.receive_json()
    assert exc.value.code == 1008


def test_allowed_origin_is_accepted(client):
    with client.websocket_connect(WS, headers={"origin": "http://localhost:3000"}) as ws:
        assert ws.receive_json()["type"] == "output"


def test_connection_limit_per_ip(client):
    limit = get_settings().ws_max_connections_per_ip
    with ExitStack() as stack:
        for _ in range(limit):
            stack.enter_context(client.websocket_connect(WS)).receive_json()
        with pytest.raises(WebSocketDisconnect) as exc, client.websocket_connect(WS) as extra:
            extra.receive_json()
        assert exc.value.code == 1008
