from sqlmodel import select

from app.models import ContactMessage

VALID_MESSAGE = {
    "name": "Recrutadora",
    "email": "rh@empresa.com",
    "message": "Olá! Gostaria de conversar sobre uma vaga backend.",
}


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["database"] == "ok"


def test_security_headers(client):
    r = client.get("/api/v1/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in r.headers["Content-Security-Policy"]


def test_docs_are_public(client):
    r = client.get("/docs")
    assert r.status_code == 200
    assert "cdn.jsdelivr.net" in r.headers["Content-Security-Policy"]


def test_list_projects(client):
    r = client.get("/api/v1/projects")
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) >= 1
    # O resumo não carrega o estudo de caso completo
    assert "problem" not in projects[0]


def test_filter_projects(client):
    r = client.get("/api/v1/projects", params={"category": "hardware"})
    assert r.status_code == 200
    assert all(p["category"] == "hardware" for p in r.json())

    r = client.get("/api/v1/projects", params={"featured": True})
    assert all(p["featured"] for p in r.json())


def test_invalid_category_is_rejected(client):
    assert client.get("/api/v1/projects", params={"category": "nope"}).status_code == 422


def test_project_detail(client):
    slug = client.get("/api/v1/projects").json()[0]["slug"]
    r = client.get(f"/api/v1/projects/{slug}")
    assert r.status_code == 200
    assert r.json()["problem"]


def test_project_not_found(client):
    assert client.get("/api/v1/projects/nao-existe").status_code == 404


def test_project_slug_is_validated(client):
    assert client.get("/api/v1/projects/DROP%20TABLE").status_code == 422


def test_profile(client):
    r = client.get("/api/v1/profile")
    assert r.status_code == 200
    body = r.json()
    assert [t["version"] for t in body["timeline"]] == ["v1.0", "v1.5", "v2.0"]
    assert body["skills"]


def test_contact_stores_message_with_hashed_ip(client, session):
    r = client.post("/api/v1/contact", json=VALID_MESSAGE)
    assert r.status_code == 202
    stored = session.exec(select(ContactMessage)).one()
    assert stored.email == VALID_MESSAGE["email"]
    assert len(stored.ip_hash) == 64
    assert stored.ip_hash != "testclient"


def test_contact_validation(client):
    r = client.post("/api/v1/contact", json={**VALID_MESSAGE, "email": "invalido"})
    assert r.status_code == 422
    r = client.post("/api/v1/contact", json={**VALID_MESSAGE, "message": "curta"})
    assert r.status_code == 422


def test_contact_honeypot_is_silently_dropped(client, session):
    r = client.post("/api/v1/contact", json={**VALID_MESSAGE, "website": "http://spam"})
    assert r.status_code == 202
    assert session.exec(select(ContactMessage)).first() is None


def test_contact_rate_limit(client):
    statuses = [client.post("/api/v1/contact", json=VALID_MESSAGE).status_code for _ in range(6)]
    assert statuses[:5] == [202] * 5
    assert statuses[5] == 429
