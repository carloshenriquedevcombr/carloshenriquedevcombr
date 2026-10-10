"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  PUBLIC_API_URL,
  type PipelineAlert,
  type PipelineEvent,
  type PipelineStats,
} from "@/lib/api";
import { useReducedMotion, useWideScreen } from "@/lib/hooks";
import { useReconnectingSocket } from "@/lib/ws";
import { SOURCE_COLOR, type Spawn } from "./reactor-scene";

const ReactorScene = dynamic(() => import("./reactor-scene"), {
  ssr: false,
  loading: () => <p className="cursor-blink p-4 font-mono text-xs text-muted">carregando reator</p>,
});

type FeedMessage =
  | { type: "hello"; stats: PipelineStats; events: PipelineEvent[]; alerts: PipelineAlert[] }
  | { type: "event"; event: PipelineEvent; stats: PipelineStats }
  | { type: "alert"; alert: PipelineAlert };

const EMPTY: PipelineStats = { extracted: 0, transformed: 0, loaded: 0, blocked: 0, alerts: 0 };

// Status com ícone + rótulo: a severidade nunca depende só da cor
const SEVERITY = {
  high: { icon: "▲", label: "alta", className: "text-red-400 border-red-400/40" },
  medium: { icon: "◆", label: "média", className: "text-amber-400 border-amber-400/40" },
  low: { icon: "●", label: "baixa", className: "text-sky-300 border-sky-300/40" },
} as const;

const clock = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("pt-BR", { hour12: false });

export function DataReactor() {
  const [stats, setStats] = useState<PipelineStats>(EMPTY);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [alerts, setAlerts] = useState<PipelineAlert[]>([]);
  const [alertTick, setAlertTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useRef<Spawn[]>([]);
  const wide = useWideScreen();
  const reducedMotion = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const { status } = useReconnectingSocket("/api/v1/pipeline/ws", (data) => {
    const msg = data as FeedMessage;
    if (msg.type === "hello") {
      setStats(msg.stats);
      setEvents(msg.events.slice(-8).reverse());
      setAlerts(msg.alerts.slice(-6).reverse());
    } else if (msg.type === "event") {
      setStats(msg.stats);
      setEvents((prev) => [msg.event, ...prev].slice(0, 8));
      if (queue.current.length < 200) {
        queue.current.push({ source: msg.event.source, malicious: msg.event.malicious });
      }
    } else if (msg.type === "alert") {
      setAlerts((prev) => [msg.alert, ...prev].slice(0, 6));
      setAlertTick((n) => n + 1);
    }
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [wide]);

  async function inject(scenario: "traffic" | "attack") {
    setNotice(null);
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/pipeline/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (res.status === 429) setNotice("O reator está ocupado — espere alguns segundos.");
      else if (!res.ok) setNotice(`Erro inesperado (${res.status}).`);
    } catch {
      setNotice("Não foi possível falar com a API.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <Counter label="extraídos" value={stats.extracted} />
          <Counter label="carregados" value={stats.loaded} />
          <Counter label="desviados ao SIEM" value={stats.blocked} />
          <Counter label="alertas" value={stats.alerts} />
        </dl>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inject("traffic")}
            className="rounded border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent"
          >
            ▶ gerar tráfego
          </button>
          <button
            type="button"
            onClick={() => inject("attack")}
            className="rounded border border-red-500/60 px-3 py-1.5 font-mono text-xs text-red-300 hover:bg-red-500/10"
          >
            ⚠ inject anomaly
          </button>
        </div>
      </div>
      {notice && (
        <p role="status" className="font-mono text-xs text-amber-300">
          {notice}
        </p>
      )}

      {wide && (
        <div
          ref={box}
          className="relative h-[420px] overflow-hidden rounded-lg border border-border bg-[#05070a]"
        >
          <ReactorScene
            queue={queue}
            loaded={stats.loaded}
            alertTick={alertTick}
            reducedMotion={reducedMotion}
            active={visible}
          />
          <ul className="pointer-events-none absolute top-3 left-3 space-y-0.5 font-mono text-[10px] text-muted">
            <li>
              <Dot color={SOURCE_COLOR.http} /> requisição HTTP
            </li>
            <li>
              <Dot color={SOURCE_COLOR.terminal} /> comando no terminal
            </li>
            <li>
              <Dot color={SOURCE_COLOR.ctf} /> CTF · contato
            </li>
            <li>
              <Dot color="#ff4d5e" /> malicioso → SIEM
            </li>
          </ul>
          <p className="pointer-events-none absolute top-3 right-3 font-mono text-[10px] text-muted">
            feed: {status === "open" ? "ao vivo" : "reconectando..."}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="alerts-title" className="min-w-0 rounded-lg border border-border bg-surface/70 p-4">
          <h3 id="alerts-title" className="font-mono text-xs text-muted">
            alertas do SIEM
          </h3>
          {alerts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nenhum alerta ainda. Clique em <span className="font-mono text-red-300">inject anomaly</span> ou
              tente algo suspeito no terminal.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => {
                const sev = SEVERITY[a.severity];
                return (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                    <span className={`rounded border px-1.5 font-mono text-[11px] ${sev.className}`}>
                      {sev.icon} {sev.label}
                    </span>
                    <span>{a.title}</span>
                    {a.technique && (
                      <a
                        href={`https://attack.mitre.org/techniques/${a.technique.replace(".", "/")}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-accent-2 hover:underline"
                      >
                        {a.technique}
                      </a>
                    )}
                    <span className="font-mono text-[11px] text-muted">
                      {a.rule} · {clock(a.ts)}
                      {a.synthetic && " · sintético"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="events-title" className="min-w-0 rounded-lg border border-border bg-surface/70 p-4">
          <h3 id="events-title" className="font-mono text-xs text-muted">
            eventos recentes
          </h3>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aguardando eventos...</p>
          ) : (
            <ul className="mt-3 space-y-1 font-mono text-[12px]">
              {events.map((e) => (
                <li key={e.id} className="flex gap-2 truncate">
                  <span className="text-muted">{clock(e.ts)}</span>
                  <span style={{ color: e.malicious ? "#ff4d5e" : SOURCE_COLOR[e.source] }}>
                    {e.malicious ? "✕" : "✓"}
                  </span>
                  <span className="truncate">{e.kind}</span>
                  {e.status !== null && <span className="text-muted">{e.status}</span>}
                  {e.latency_ms !== null && <span className="text-muted">{e.latency_ms}ms</span>}
                  {e.synthetic && <span className="text-muted">· sint.</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
}
