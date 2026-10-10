"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReconnectingSocket } from "@/lib/ws";
import {
  KNOWN_COMMANDS,
  MODE_COLOR,
  type LabMode,
  type TerminalEvent,
  type TerminalLine,
  type TerminalMessage,
} from "./types";

const MAX_LINES = 300;

const STYLE_CLASS: Record<string, string> = {
  accent: "text-accent",
  muted: "text-muted",
  error: "text-red-400",
  info: "text-accent-2",
  input: "text-foreground",
};

const SUGGESTIONS = ["help", "nmap lab.local", "mode red", "ls projects", "sudo hire carlos"];

export function Terminal({
  mode,
  onEvent,
}: {
  mode: LabMode;
  onEvent: (event: TerminalEvent) => void;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const append = (more: TerminalLine[]) =>
    setLines((prev) => [...prev, ...more].slice(-MAX_LINES));

  const { status, send } = useReconnectingSocket("/api/v1/terminal/ws", (data) => {
    const msg = data as TerminalMessage;
    if (msg.type !== "output") return;
    if (msg.event?.type === "clear") {
      setLines([]);
      return;
    }
    append([...msg.lines, { text: "", style: null }]);
    if (msg.event?.type === "navigate") {
      const href = msg.event.href;
      setTimeout(() => router.push(href), 900);
    }
    if (msg.event) onEvent(msg.event);
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    append([{ text: `$ ${cmd}`, style: "input" }]);
    if (!send(cmd)) {
      append([{ text: "[ ERR ] sem conexão com a API — tentando reconectar...", style: "error" }]);
    }
    setHistory((h) => [...h.filter((c) => c !== cmd), cmd].slice(-50));
    setCursor(-1);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const next = cursor === -1 ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown" && cursor !== -1) {
      e.preventDefault();
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(-1);
        setInput("");
      } else {
        setCursor(next);
        setInput(history[next]);
      }
    } else if (e.key === "Tab" && input) {
      e.preventDefault();
      const match = KNOWN_COMMANDS.find((c) => c.startsWith(input.toLowerCase()));
      if (match) setInput(match);
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  const color = MODE_COLOR[mode];

  return (
    <div
      className="flex h-[460px] flex-col overflow-hidden rounded-lg border bg-[#05070a] shadow-[0_0_30px_rgb(0_0_0/0.4)] transition-colors"
      style={{ borderColor: `${color}66` }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-[11px] text-muted">
        <span>
          visitante@lab:~ <span style={{ color }}>[{mode}]</span>
        </span>
        <span role="status" className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              status === "open" ? "bg-accent" : status === "connecting" ? "bg-amber-400" : "bg-red-500"
            }`}
          />
          {status === "open" ? "ws conectado" : status === "connecting" ? "conectando..." : "offline"}
        </span>
      </div>

      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Saída do terminal"
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed"
      >
        {lines.map((line, i) => (
          <p key={i} className={`whitespace-pre-wrap ${line.style ? STYLE_CLASS[line.style] : ""}`}>
            {line.text || " "}
          </p>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        className="flex items-center gap-2 border-t border-border px-4 py-2.5 font-mono text-[13px]"
      >
        <label htmlFor="terminal-input" style={{ color }}>
          $
        </label>
        <input
          id="terminal-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={512}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Comando do terminal"
          placeholder="digite um comando (help)"
          className="flex-1 bg-transparent outline-none placeholder:text-muted/60"
        />
      </form>

      <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              run(s);
            }}
            className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:border-muted hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
