import time

from app.pipeline import simulator

WS = "/api/v1/pipeline/ws"


def test_hello_snapshot(client):
    with client.websocket_connect(WS) as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello"
        assert set(hello["stats"]) == {"extracted", "transformed", "loaded", "blocked", "alerts"}


def test_http_requests_flow_through_the_pipeline(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        client.get("/api/v1/projects/the-lab-portfolio")
        msg = ws.receive_json()
        assert msg["type"] == "event"
        event = msg["event"]
        assert event["kind"] == "GET /api/v1/projects/{slug}"  # template, não o slug
        assert event["status"] == 200
        assert "actor" not in event and "detail" not in event  # nada privado vaza
        assert msg["stats"]["extracted"] >= 1


def test_unknown_paths_are_not_reflected(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        client.get("/api/v1/<script>alert(1)</script>")
        event = ws.receive_json()["event"]
        assert event["kind"] == "GET <404>"


def test_cors_preflight_is_labeled(client):
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        client.options(
            "/api/v1/contact",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
        )
        assert ws.receive_json()["event"]["kind"] == "OPTIONS (preflight CORS)"


def test_terminal_injection_raises_alert(client):
    with client.websocket_connect(WS) as feed, client.websocket_connect("/api/v1/terminal/ws") as t:
        feed.receive_json()
        t.receive_json()
        t.send_text("ls; cat /etc/passwd")
        t.receive_json()
        messages = [feed.receive_json() for _ in range(3)]
        alerts = [m["alert"] for m in messages if m["type"] == "alert"]
        assert {a["rule"] for a in alerts} >= {"LAB-001", "LAB-002"}
        event = next(m["event"] for m in messages if m["type"] == "event")
        assert event["malicious"] is True
        assert event["kind"] == "cmd:unknown"  # o texto digitado nunca é repassado


def test_inject_attack_scenario(client, monkeypatch):
    monkeypatch.setattr(simulator.asyncio, "sleep", _no_sleep)
    with client.websocket_connect(WS) as ws:
        ws.receive_json()
        assert (
            client.post("/api/v1/pipeline/inject", json={"scenario": "attack"}).status_code == 202
        )
        expected = {"LAB-001", "LAB-002", "LAB-003", "LAB-004", "LAB-005", "LAB-006", "LAB-008"}
        alerts = set()
        deadline = time.time() + 5
        while not expected <= alerts and time.time() < deadline:
            msg = ws.receive_json()
            if msg["type"] == "alert":
                assert msg["alert"]["synthetic"] is True
                alerts.add(msg["alert"]["rule"])
        assert expected <= alerts


def test_inject_validation_and_rate_limit(client):
    assert client.post("/api/v1/pipeline/inject", json={"scenario": "rm"}).status_code == 422
    codes = [
        client.post("/api/v1/pipeline/inject", json={"scenario": "traffic"}).status_code
        for _ in range(5)
    ]
    assert 429 in codes


async def _no_sleep(_):
    return None
