"""Interpretador do terminal do portfólio.

Segurança por design: NENHUM comando chega a um shell. A entrada é quebrada em
tokens e comparada com uma lista fechada de comandos implementados em Python;
qualquer outra coisa recebe "command not found".
"""

import shlex
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from sqlmodel import Session, func, select

from app.core.metrics import uptime_seconds
from app.models import Project, Skill, SkillGroup, TimelineEntry

# Hosts do "laboratório": espelham o docker-compose real (e o rack 3D no frontend)
_HOSTS = [
    # id, ip, porta, estado, serviço
    ("gw", "10.0.0.1", "443/tcp", "open", "https (proxy reverso)"),
    ("web", "10.0.0.10", "3000/tcp", "open", "http (Next.js)"),
    ("api", "10.0.0.20", "8000/tcp", "open", "http (FastAPI)"),
    ("db", "10.0.0.30", "5432/tcp", "filtered", "postgresql"),
    ("cache", "10.0.0.40", "6379/tcp", "filtered", "redis"),
]
LAB_HOSTS = [
    {"id": i, "ip": ip, "port": port, "state": state, "service": svc}
    for i, ip, port, state, svc in _HOSTS
]

MODES = {
    "red": "Modo RED TEAM: pensar como atacante — reconhecimento, superfície, exploração.",
    "blue": "Modo BLUE TEAM: detecção, hardening e resposta a incidentes. Escudos ativos.",
    "purple": "Modo PURPLE TEAM: ataque e defesa juntos — cada técnica testada vira uma detecção.",
    "normal": "Modo padrão restaurado.",
}

GROUP_LABEL = {
    SkillGroup.backend_automation: "backend & automação",
    SkillGroup.data_engineering: "engenharia de dados",
    SkillGroup.cybersecurity: "cybersecurity",
    SkillGroup.infrastructure: "infraestrutura",
    SkillGroup.hardware: "hardware",
}


@dataclass
class Line:
    text: str
    style: str | None = None  # "accent" | "muted" | "error" | "info"


@dataclass
class Reply:
    lines: list[Line] = field(default_factory=list)
    event: dict[str, Any] | None = None

    def out(self, text: str = "", style: str | None = None) -> "Reply":
        self.lines.append(Line(text, style))
        return self


@dataclass
class Context:
    session: Session
    stats: dict[str, int]


Handler = Callable[[list[str], Context], Reply]
COMMANDS: dict[str, tuple[Handler, str]] = {}


def command(name: str, help_text: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        COMMANDS[name] = (fn, help_text)
        return fn

    return register


def run(raw: str, ctx: Context) -> Reply:
    raw = raw.strip()
    if not raw:
        return Reply()
    try:
        tokens = shlex.split(raw)
    except ValueError:
        return Reply().out("erro de sintaxe: aspas não fechadas", "error")
    if not tokens:
        return Reply()
    name, args = tokens[0].lower(), tokens[1:]
    entry = COMMANDS.get(name)
    if entry is None:
        return Reply().out(f"{name}: command not found — digite 'help'", "error")
    return entry[0](args, ctx)


@command("help", "lista os comandos disponíveis")
def _help(args: list[str], ctx: Context) -> Reply:
    reply = Reply().out("comandos disponíveis:", "accent")
    for name, (_, text) in COMMANDS.items():
        if not text.startswith("_"):
            reply.out(f"  {name:<10} {text}")
    return reply.out().out("dica: ↑/↓ navegam no histórico, Tab completa comandos.", "muted")


@command("whoami", "quem é o dono deste laboratório")
def _whoami(args: list[str], ctx: Context) -> Reply:
    return (
        Reply()
        .out("carlos henrique", "accent")
        .out("backend developer · automação · dados · cybersecurity")
        .out("ex-suporte de TI: hoje construo sistemas que eliminam os chamados.", "muted")
    )


@command("ls", "lista os projetos (ls projects)")
def _ls(args: list[str], ctx: Context) -> Reply:
    target = args[0] if args else "projects"
    if target.rstrip("/") not in ("projects", "projetos", "."):
        return Reply().out(f"ls: não foi possível acessar '{target}': permissão negada", "error")
    projects = ctx.session.exec(select(Project).order_by(Project.sort_order)).all()
    reply = Reply()
    for p in projects:
        reply.out(f"  {p.slug:<28} [{p.category.value}]", "accent" if p.featured else None)
    return reply.out(f"{len(projects)} projetos · use 'cat <projeto>' para detalhes", "muted")


@command("cat", "mostra um projeto (cat <projeto>)")
def _cat(args: list[str], ctx: Context) -> Reply:
    if not args:
        return Reply().out("uso: cat <projeto>  (veja 'ls projects')", "error")
    slug = args[0].removeprefix("projects/").removesuffix(".md")
    project = ctx.session.exec(select(Project).where(Project.slug == slug)).first()
    if project is None:
        return Reply().out(f"cat: {args[0]}: arquivo não encontrado", "error")
    return (
        Reply()
        .out(f"# {project.title}", "accent")
        .out(project.summary)
        .out(f"stack: {', '.join(project.stack)}", "muted")
        .out(f"→ estudo de caso completo em /projects/{project.slug}", "info")
    )


@command("skills", "módulos instalados, agrupados por área")
def _skills(args: list[str], ctx: Context) -> Reply:
    skills = ctx.session.exec(select(Skill).order_by(Skill.group, Skill.sort_order)).all()
    groups: dict[str, list[str]] = {}
    for s in skills:
        groups.setdefault(GROUP_LABEL.get(s.group, s.group.value), []).append(s.name)
    reply = Reply()
    for group, names in groups.items():
        reply.out(f"[{group}]", "accent").out(f"  {', '.join(names)}")
    return reply


@command("timeline", "a trajetória: suporte → desenvolvimento")
def _timeline(args: list[str], ctx: Context) -> Reply:
    entries = ctx.session.exec(select(TimelineEntry).order_by(TimelineEntry.sort_order)).all()
    reply = Reply()
    for e in entries:
        reply.out(f"{e.version}  {e.title}", "accent").out(f"      {e.description}", "muted")
    return reply


@command("nmap", "varre a rede do laboratório (nmap lab.local)")
def _nmap(args: list[str], ctx: Context) -> Reply:
    target = next((a for a in args if not a.startswith("-")), "lab.local")
    if target not in ("lab.local", "10.0.0.0/24", "localhost"):
        return (
            Reply()
            .out(f"nmap: alvo '{target}' fora do escopo autorizado.", "error")
            .out("Hacking ético começa pelo escopo: só 'lab.local' está liberado aqui.", "muted")
        )
    reply = Reply().out(f"Starting Nmap scan of {target} (10.0.0.0/24)", "muted")
    reply.out("PORT       STATE     SERVICE                 HOST", "accent")
    for h in LAB_HOSTS:
        style = "error" if h["state"] == "filtered" else None
        host = f"{h['id']} ({h['ip']})"
        reply.out(f"{h['port']:<10} {h['state']:<9} {h['service']:<23} {host}", style)
    reply.out()
    reply.out("db e cache aparecem como 'filtered': não têm porta exposta fora da rede", "muted")
    reply.out("interna dos contêineres. Superfície de ataque mínima por design.", "muted")
    reply.event = {"type": "scan", "hosts": [h["id"] for h in LAB_HOSTS]}
    return reply


@command("mode", "muda a postura do lab (mode red|blue|purple|normal)")
def _mode(args: list[str], ctx: Context) -> Reply:
    mode = args[0].lower() if args else ""
    if mode not in MODES:
        return Reply().out("uso: mode red | blue | purple | normal", "error")
    reply = Reply().out(MODES[mode], "accent")
    reply.event = {"type": "mode", "mode": mode}
    return reply


@command("uptime", "há quanto tempo a API está no ar")
def _uptime(args: list[str], ctx: Context) -> Reply:
    seconds = uptime_seconds()
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return Reply().out(
        f"up {h}h {m:02d}m {s:02d}s · {ctx.stats.get('requests_total', 0)} requisições servidas · "
        f"{ctx.stats.get('terminal_commands_total', 0)} comandos executados neste terminal"
    )


@command("stats", "números do laboratório")
def _stats(args: list[str], ctx: Context) -> Reply:
    projects = ctx.session.exec(select(func.count()).select_from(Project)).one()
    skills = ctx.session.exec(select(func.count()).select_from(Skill)).one()
    return (
        Reply()
        .out(f"projetos documentados .. {projects}")
        .out(f"skills com evidência ... {skills}")
        .out(f"requisições servidas ... {ctx.stats.get('requests_total', 0)}")
        .out("→ painel completo na seção Live Metrics", "info")
    )


@command("contact", "como falar comigo")
def _contact(args: list[str], ctx: Context) -> Reply:
    reply = (
        Reply()
        .out("abrindo canal seguro... → seção de contato", "accent")
        .out("email: contato@carloshenriquedev.com.br", "muted")
    )
    reply.event = {"type": "navigate", "href": "/#contato"}
    return reply


@command("clear", "limpa a tela")
def _clear(args: list[str], ctx: Context) -> Reply:
    return Reply(event={"type": "clear"})


@command("sudo", "_")
def _sudo(args: list[str], ctx: Context) -> Reply:
    if [a.lower() for a in args[:2]] == ["hire", "carlos"]:
        reply = (
            Reply()
            .out("[sudo] senha para recrutador: ********", "muted")
            .out("Acesso concedido. Excelente decisão. 🚀", "accent")
            .out("Redirecionando para o handshake...", "info")
        )
        reply.event = {"type": "navigate", "href": "/#contato"}
        return reply
    return Reply().out(
        "recrutador não está no arquivo sudoers. Este incidente será reportado.", "error"
    )


@command("rm", "_")
def _rm(args: list[str], ctx: Context) -> Reply:
    return (
        Reply()
        .out("Boa tentativa. 🙂", "accent")
        .out("Este terminal é um sandbox: nenhum comando é executado num shell real.", "muted")
        .out("Cada comando é uma função Python numa lista fechada (allowlist).", "muted")
    )


@command("exit", "_")
def _exit(args: list[str], ctx: Context) -> Reply:
    return Reply().out("Não há saída do laboratório. Mas há uma vaga: 'contact'.", "muted")
