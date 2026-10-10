import base64

from app.ctf import flag_for

SUBMIT = "/api/v1/ctf/submit"


def test_challenges_do_not_leak_flags(client):
    body = client.get("/api/v1/ctf/challenges").text
    assert [c["id"] for c in client.get("/api/v1/ctf/challenges").json()] == [
        "headers",
        "source",
        "terminal",
    ]
    assert "LAB{" not in body


def test_headers_flag_is_in_health(client):
    assert client.get("/api/v1/health").headers["X-Lab-Flag"] == flag_for("headers")


def test_terminal_flag_requires_hidden_file_and_decoding(client):
    with client.websocket_connect("/api/v1/terminal/ws") as ws:
        ws.receive_json()
        ws.send_text("ls")
        assert ".secret" not in str(ws.receive_json())
        ws.send_text("ls -a")
        assert ".secret" in str(ws.receive_json())
        ws.send_text("cat .secret")
        encoded = ws.receive_json()["lines"][0]["text"]
        assert base64.b64decode(encoded).decode() == flag_for("terminal")
        ws.send_text(f"base64 -d {encoded}")
        assert ws.receive_json()["lines"][0]["text"] == flag_for("terminal")


def test_submit_and_hall_of_fame(client):
    ok = client.post(SUBMIT, json={"nickname": "neo", "flag": flag_for("source")}).json()
    assert ok["correct"] and ok["points"] == 150 and not ok["already_solved"]

    again = client.post(SUBMIT, json={"nickname": "neo", "flag": flag_for("source")}).json()
    assert again["already_solved"]

    client.post(SUBMIT, json={"nickname": "trinity", "flag": flag_for("terminal")})
    board = client.get("/api/v1/ctf/hall-of-fame").json()
    assert [e["nickname"] for e in board] == ["trinity", "neo"]
    assert board[0]["points"] == 200


def test_wrong_flag(client):
    r = client.post(SUBMIT, json={"nickname": "neo", "flag": "LAB{nope}"}).json()
    assert r["correct"] is False


def test_nickname_is_validated(client):
    bad = client.post(SUBMIT, json={"nickname": "<img src=x>", "flag": flag_for("source")})
    assert bad.status_code == 422


def test_submission_rate_limit(client):
    codes = [
        client.post(SUBMIT, json={"nickname": "brute", "flag": f"LAB{{{i}}}"}).status_code
        for i in range(11)
    ]
    assert codes[:10] == [200] * 10
    assert codes[10] == 429


def test_headers_flag_also_answers_head(client):
    # `curl -I` é o primeiro reflexo de quem faz recon
    r = client.head("/api/v1/health")
    assert r.status_code == 200
    assert r.headers["X-Lab-Flag"] == flag_for("headers")
