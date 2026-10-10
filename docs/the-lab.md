# 🧪 The Lab — Portfólio full-stack

Código do portfólio [carloshenriquedev.com.br](https://carloshenriquedev.com.br).
O `README.md` da raiz continua sendo o perfil do GitHub; o projeto vive em `backend/` e `frontend/`.

```
backend/    API FastAPI + SQLModel + Alembic (PostgreSQL)
frontend/   Next.js (App Router) + TypeScript + Tailwind
docker-compose.yml   db + redis + api + web
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
| GET | `/metrics` | Snapshot das métricas (uptime, requisições, comandos, GitHub) |
| WS | `/terminal/ws` | Terminal interativo (texto → JSON com linhas e eventos) |
| WS | `/metrics/ws` | Métricas ao vivo, um snapshot a cada 3s |
| GET | `/pipeline/stats` | Contadores, eventos e alertas recentes do Data Reactor |
| POST | `/pipeline/inject` | Cenário sintético (`traffic` ou `attack`) pela pipeline real |
| WS | `/pipeline/ws` | Cada evento e alerta da pipeline em tempo real |
| GET | `/ctf/challenges` | Desafios do CTF (sem as flags) |
| POST | `/ctf/submit` | Envio de flag (rate limit de 10 a cada 10 min) |
| GET | `/ctf/hall-of-fame` | Ranking |

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

## Cena 3D — Workbench (Fase 2)

Placa IoT modelada em código com React Three Fiber (sem arquivos `.glb`), em
`frontend/src/components/workbench/`:

- `parts.ts` — componentes clicáveis (MCU, Flash SPI, UART, USB, antena) e seus textos
- `scene.tsx` — a cena: vista explodida animada, pulsos de dados nas trilhas, LEDs, bloom
- `workbench.tsx` — UI ao redor da cena (montar/desmontar, card de informação, botões acessíveis)

Cuidados de performance e acessibilidade:

- three.js fica num chunk separado, carregado só no navegador e só em telas `md+`
- renderização pausada quando a bancada sai da tela; resolução e bloom caem se o FPS cair
- `prefers-reduced-motion` desliga rotação automática, pulsos e animações
- sem WebGL, aparece a versão 2D; todos os componentes também são acessíveis por botões

## Terminal e Live Metrics (Fase 3)

**Terminal** (`backend/app/terminal/commands.py` + `frontend/src/components/terminal/`):

- Nenhum comando chega a um shell: a entrada é quebrada com `shlex` e comparada com uma
  allowlist de funções Python. Metacaracteres (`;`, `$( )`, `|`) não têm efeito.
- Proteção contra Cross-Site WebSocket Hijacking: origens fora de `CORS_ORIGINS` são recusadas.
- Limites: 512 caracteres por comando, 15 comandos a cada 10s por conexão, 10 WebSockets
  simultâneos por IP (cada página abre 3) e timeout de 5 min sem atividade.
- Comandos como `nmap lab.local` e `mode red|blue|purple` emitem eventos que animam o rack 3D.
- Para adicionar um comando: uma função com `@command("nome", "descrição")`.

**Live Metrics**: contadores (requisições, comandos) num hash do Redis, somando todas as
réplicas. Contagens do banco ficam em cache por 10s. As estatísticas do GitHub são coletadas
por uma tarefa de fundo a cada 15 min, sem token: a API pública dá 60 req/h por IP.

Sem `REDIS_URL`, rate limit e métricas ficam em memória (bom para desenvolvimento).

## Data Reactor e mini-CTF (Fase 4)

**Data Reactor** (`backend/app/pipeline/`): toda requisição HTTP da API (via
`TelemetryMiddleware`), todo comando do terminal e todo envio de contato ou flag vira um
`LabEvent`. Ele passa por Extract → Transform → Load, e no Transform o motor de detecção
(`detection.py`) aplica regras no estilo Sigma, mapeadas no MITRE ATT&CK:

| Regra | Detecta | ATT&CK |
|---|---|---|
| LAB-001 | Injeção de comando no terminal (`;`, `|`, `$( )`, `bash`...) | T1059 |
| LAB-002 | Path traversal / leitura de `/etc/passwd` | T1083 |
| LAB-003 | `nmap` fora do escopo autorizado | T1046 |
| LAB-004 | `sudo` (exceto o easter egg) | T1548 |
| LAB-005 | 5+ respostas 404 do mesmo ator em 60s | T1595.003 |
| LAB-006 | 5+ flags erradas do mesmo ator em 60s | T1110 |
| LAB-007 | Bot capturado pelo honeypot do contato | — |
| LAB-008 | Rate limit excedido | T1499 |

Privacidade: o ator é o hash do IP e nunca sai do servidor. O texto digitado no terminal
também não: os clientes só veem o nome do comando. Rotas aparecem pelo template
(`/projects/{slug}`) e caminhos inexistentes como `<404>`, para não repassar a todos os
visitantes um texto arbitrário enviado por alguém. Os botões "gerar tráfego" e "inject
anomaly" disparam eventos marcados como **sintéticos**, que passam pelas mesmas regras.

**Mini-CTF** (`backend/app/ctf.py`): três flags, cada uma um HMAC do `CTF_SECRET`, então
não estão no repositório:

1. **Recon:** header `X-Lab-Flag` em `/api/v1/health`
2. **Web:** comentário base64 no HTML (calculado pelo Next.js em `ctf-beacon.tsx`, por
   isso o `web` também recebe `CTF_SECRET`)
3. **Linux:** `ls -a` e `cat .secret` no terminal, depois `base64 -d`

## Roadmap

| Fase | Entrega | Status |
|---|---|---|
| 1 · MVP | API + banco + site 2D, CV e projetos documentados | ✅ |
| 2 · Primeira cena 3D | Workbench (React Three Fiber) no hero + Boot Sequence | ✅ |
| 3 · Interatividade | Terminal via WebSocket, Live Metrics, rate limit em Redis | ✅ |
| 4 · Data Reactor | Pipeline de partículas com dados reais + mini-CTF | ✅ |
| 5 · Hardening | CSP com nonce, página `/security`, Trivy, fallback 2D refinado | ⏳ |
