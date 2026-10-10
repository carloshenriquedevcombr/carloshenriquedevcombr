import asyncio

import fakeredis
import httpx

from app.core.metrics import RedisMetricsStore
from app.core.rate_limit import RedisRateLimiter
from app.services import github

VALID_MESSAGE = {
    "name": "Recrutadora",
    "email": "rh@empresa.com",
    "message": "Olá! Gostaria de conversar sobre uma vaga backend.",
}


def test_metrics_snapshot(client):
    body = client.get("/api/v1/metrics").json()
    assert body["projects_total"] == 4
    assert body["uptime_seconds"] >= 0
    assert body["github"] is None  # coletor desligado nos testes


def test_requests_are_counted(client):
    before = client.get("/api/v1/metrics").json()["requests_total"]
    client.get("/api/v1/health")
    client.get("/api/v1/projects")
    after = client.get("/api/v1/metrics").json()["requests_total"]
    assert after - before == 3  # health + projects + a própria chamada de métricas


def test_terminal_commands_are_counted(client):
    with client.websocket_connect("/api/v1/terminal/ws") as ws:
        ws.receive_json()
        for _ in range(2):
            ws.send_text("whoami")
            ws.receive_json()
    assert client.get("/api/v1/metrics").json()["terminal_commands_total"] == 2


def test_metrics_stream_pushes_snapshot(client):
    with client.websocket_connect("/api/v1/metrics/ws") as ws:
        data = ws.receive_json()
        assert data["live_connections"] == 1
        assert "requests_total" in data


def test_redis_rate_limiter():
    limiter = RedisRateLimiter(fakeredis.FakeRedis(decode_responses=True), 3, 60, "rl:test")
    assert [limiter.allow("ip") for _ in range(4)] == [True, True, True, False]
    assert limiter.allow("outro-ip")
    limiter.reset()
    assert limiter.allow("ip")


def test_redis_metrics_store():
    async def scenario():
        store = RedisMetricsStore(fakeredis.FakeAsyncRedis(decode_responses=True))
        await store.incr("requests_total")
        await store.incr("requests_total", 4)
        return await store.get_all()

    assert asyncio.run(scenario()) == {"requests_total": 5}


def test_github_stats_parsing():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/events/public"):
            return httpx.Response(
                200,
                json=[
                    {"type": "WatchEvent"},
                    {
                        "type": "PushEvent",
                        "created_at": "2026-10-09T12:00:00Z",
                        "repo": {"name": "carlos/lab"},
                    },
                ],
            )
        return httpx.Response(200, json={"public_repos": 7, "followers": 3})

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await github.fetch_stats(client, "carlos")

    stats = asyncio.run(scenario())
    assert stats.public_repos == 7
    assert stats.last_push_repo == "carlos/lab"
