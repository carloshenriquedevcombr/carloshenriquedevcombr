"use client";

import { useRef, useState } from "react";
import { useReconnectingSocket } from "@/lib/ws";

interface Metrics {
  timestamp: string;
  uptime_seconds: number;
  requests_total: number;
  terminal_commands_total: number;
  live_connections: number;
  projects_total: number;
  contact_messages_total: number;
  github: {
    username: string;
    public_repos: number;
    followers: number;
    last_push_at: string | null;
    last_push_repo: string | null;
  } | null;
}

const HISTORY = 20;
const nf = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

export function LiveMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  // Requisições por intervalo de 3s, calculadas a partir dos totais recebidos
  const [rate, setRate] = useState<number[]>([]);

  const lastTotal = useRef<number | null>(null);

  const { status } = useReconnectingSocket("/api/v1/metrics/ws", (msg) => {
    const next = msg as Metrics;
    if (lastTotal.current !== null) {
      const delta = Math.max(0, next.requests_total - lastTotal.current);
      setRate((r) => [...r, delta].slice(-HISTORY));
    }
    lastTotal.current = next.requests_total;
    setData(next);
  });

  const live = status === "open";

  return (
    <div>
      <p role="status" className="mb-4 flex items-center gap-2 font-mono text-xs text-muted">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${live ? "animate-pulse bg-accent" : "bg-amber-400"}`}
        />
        {live ? "ao vivo · WebSocket · atualiza a cada 3s" : "reconectando ao feed de métricas..."}
      </p>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Uptime da API" value={data ? formatUptime(data.uptime_seconds) : "—"} />
        <Tile
          label="Requisições servidas"
          value={data ? nf.format(data.requests_total) : "—"}
          footer={<Sparkline values={rate} />}
        />
        <Tile
          label="Comandos no terminal"
          value={data ? nf.format(data.terminal_commands_total) : "—"}
          hint="executados por visitantes na seção acima"
        />
        <Tile
          label="Conexões ao vivo"
          value={data ? String(data.live_connections) : "—"}
          hint="WebSockets abertos agora (terminal + este painel)"
        />
        <Tile
          label="Projetos documentados"
          value={data ? String(data.projects_total) : "—"}
          hint="lidos do PostgreSQL"
        />
        <Tile
          label="GitHub"
          value={data?.github ? `${data.github.public_repos} repos` : "—"}
          hint={
            data?.github?.last_push_at
              ? `último push ${timeAgo(data.github.last_push_at)} · ${data.github.last_push_repo}`
              : "coletado por uma tarefa de fundo na API"
          }
        />
      </dl>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  footer,
}: {
  label: string;
  value: string;
  hint?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface/70 p-4">
      <dt className="font-mono text-xs text-muted">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
      {footer && <dd className="mt-3">{footer}</dd>}
    </div>
  );
}

/** Sparkline de série única: linha neutra, ponto atual no acento, tooltip no hover. */
function Sparkline({ values }: { values: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 240;
  const H = 40;
  const PAD = 4;

  if (values.length < 2) {
    return <p className="font-mono text-[11px] text-muted">coletando série de req/3s...</p>;
  }

  const max = Math.max(...values, 1);
  const step = (W - PAD * 2) / (HISTORY - 1);
  const offset = HISTORY - values.length;
  const points = values.map((v, i) => [PAD + (i + offset) * step, H - PAD - (v / max) * (H - PAD * 2)]);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  const active = hover ?? values.length - 1;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-10 w-full overflow-visible"
        role="img"
        aria-label={`Requisições por intervalo de 3 segundos; último valor ${values[values.length - 1]}, máximo ${max}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round((x - PAD) / step) - offset;
          setHover(Math.min(values.length - 1, Math.max(0, i)));
        }}
      >
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} />
        <path d={path} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <line
            x1={points[hover][0]}
            x2={points[hover][0]}
            y1={PAD}
            y2={H - PAD}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
        <circle
          cx={hover !== null ? points[hover][0] : lastX}
          cy={hover !== null ? points[hover][1] : lastY}
          r={4}
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
      </svg>
      <figcaption className="mt-1 font-mono text-[11px] text-muted">
        req/3s · {hover !== null ? `${values.length - 1 - active} intervalos atrás: ` : "agora: "}
        <span className="text-foreground">{values[active]}</span>
      </figcaption>
    </figure>
  );
}
