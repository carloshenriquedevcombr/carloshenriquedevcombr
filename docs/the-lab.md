# 🧪 The Lab — Portfólio full-stack

Código do portfólio [carloshenriquedev.com.br](https://carloshenriquedev.com.br).
O `README.md` da raiz continua sendo o perfil do GitHub; o projeto vive em `backend/` e `frontend/`.

```
backend/    API FastAPI + SQLModel + Alembic (PostgreSQL)
frontend/   Next.js (App Router) + TypeScript + Tailwind
docker-compose.yml   db + api + web
.github/workflows/ci.yml   lint, testes, SAST, migrations, build e gitleaks
```

## Rodando com Docker (tudo de uma vez)

```bash
cp .env.example .env          # troque POSTGRES_PASSWORD e IP_HASH_SALT
docker compose up --build
```

- Site: http://localhost:3000
- API + Swagger: http://localhost:8000/docs

Ao subir, a API aplica as migrations e roda o seed automaticamente.

## Rodando sem Docker (desenvolvimento)

**Backend** (precisa de um PostgreSQL local; sem `DATABASE_URL` ele usa SQLite em `lab.db`):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

**Frontend**:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Checks locais (os mesmos do CI)

```bash
cd backend  && ruff check . && ruff format --check . && pytest -q && bandit -c pyproject.toml -r app
cd frontend && npm run lint && npm run typecheck && npm run build
```

## API (`/api/v1`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status da API e do banco |
| GET | `/projects?category=&featured=` | Lista de projetos (resumo) |
| GET | `/projects/{slug}` | Estudo de caso completo |
| GET | `/profile` | Timeline da carreira + skills com evidências |
| POST | `/contact` | Formulário de contato (rate limit + honeypot) |

## Editando o conteúdo

Todo o conteúdo (timeline, skills e projetos) está em
[`backend/app/seed/data.json`](../backend/app/seed/data.json). Edite e rode `python -m app.seed`:
o seed faz upsert por `slug` (projetos), `version` (timeline) e `name` (skills).

> ⚠️ Os textos iniciais são um rascunho baseado no README do perfil. Revise cada projeto com os
> detalhes reais (links de repositório, números de impacto medidos, decisões técnicas).

Mudou um modelo em `app/models.py`? Gere a migration:

```bash
alembic revision --autogenerate -m "descrição"
```

## Segurança (já na Fase 1)

- Headers de hardening na API e no site (CSP, `X-Frame-Options`, `nosniff`, HSTS em produção)
- Validação estrita de entrada com Pydantic; schemas de saída separados dos modelos do banco
- Formulário de contato com rate limit por IP, honeypot e IP gravado só como hash com sal
- A API se recusa a subir em produção com o sal padrão
- CORS restrito às origens configuradas; banco sem porta exposta no compose
- Contêineres rodando como usuário não-root
- CI com Ruff, Bandit (SAST) e gitleaks (vazamento de segredos)

## Roadmap

| Fase | Entrega | Status |
|---|---|---|
| 1 · MVP | API + banco + site 2D, CV e projetos documentados | ✅ |
| 2 · Primeira cena 3D | Workbench (React Three Fiber) no hero + Boot Sequence | ⏳ |
| 3 · Interatividade | Terminal via WebSocket, Live Metrics, rate limit em Redis | ⏳ |
| 4 · Data Reactor | Pipeline de partículas com dados reais + mini-CTF | ⏳ |
| 5 · Hardening | CSP com nonce, página `/security`, Trivy, fallback 2D refinado | ⏳ |
