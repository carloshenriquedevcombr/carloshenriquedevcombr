"use client";

import { useCallback, useEffect, useState } from "react";
import { PUBLIC_API_URL, type Challenge, type HallOfFameEntry } from "@/lib/api";

const NICK_KEY = "lab:ctf-nickname";

type Result = { kind: "ok" | "error"; message: string } | null;

function readNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

export function CtfBoard({ challenges }: { challenges: Challenge[] }) {
  const [board, setBoard] = useState<HallOfFameEntry[] | null>(null);
  const [nickname, setNickname] = useState("");
  const [flag, setFlag] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [sending, setSending] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/ctf/hall-of-fame`);
      if (res.ok) setBoard(await res.json());
    } catch {
      // placar indisponível: mantém o estado anterior
    }
  }, []);

  useEffect(() => {
    // Conveniência por visitante: lembra o apelido entre visitas
    const id = setTimeout(() => {
      setNickname(readNickname());
      void loadBoard();
    }, 0);
    return () => clearTimeout(id);
  }, [loadBoard]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      localStorage.setItem(NICK_KEY, nickname);
    } catch {
      // sem storage: segue sem lembrar o apelido
    }
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/ctf/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, flag }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 429) setResult({ kind: "error", message: "Muitas tentativas. Volte em alguns minutos." });
      else if (res.status === 422) setResult({ kind: "error", message: "Apelido: 3–24 letras, números, _ ou -." });
      else if (body?.correct) {
        setResult({ kind: "ok", message: body.message });
        setFlag("");
        void loadBoard();
      } else setResult({ kind: "error", message: body?.message ?? `Erro (${res.status}).` });
    } catch {
      setResult({ kind: "error", message: "Não foi possível falar com a API." });
    } finally {
      setSending(false);
    }
  }

  const input =
    "mt-1 w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <ol className="space-y-3">
        {challenges.map((c, i) => (
          <li key={c.id} className="rounded-lg border border-border bg-surface/70 p-4">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-accent">
                #{i + 1} · {c.category}
              </span>
              <span className="text-muted">{c.points} pts</span>
            </div>
            <h3 className="mt-2 font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-muted">{c.hint}</p>
          </li>
        ))}
        <li className="font-mono text-xs text-muted">
          formato das flags: <span className="text-foreground">LAB{"{...}"}</span> · regras: só este
          site, sem automação agressiva (há rate limit e o SIEM está de olho 👀)
        </li>
      </ol>

      <div className="space-y-6">
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-surface/70 p-4">
          <h3 className="font-mono text-sm text-accent">./submit-flag</h3>
          <div>
            <label htmlFor="ctf-nick" className="font-mono text-xs text-muted">
              apelido (aparece no Hall of Fame)
            </label>
            <input
              id="ctf-nick"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              pattern="[A-Za-z0-9_\-]{3,24}"
              maxLength={24}
              autoComplete="nickname"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="ctf-flag" className="font-mono text-xs text-muted">
              flag
            </label>
            <input
              id="ctf-flag"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              required
              maxLength={100}
              placeholder="LAB{...}"
              autoComplete="off"
              spellCheck={false}
              className={input}
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="rounded bg-accent px-4 py-2 font-mono text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-60"
          >
            {sending ? "verificando..." : "enviar"}
          </button>
          <p aria-live="polite" className="min-h-5 font-mono text-sm">
            {result && (
              <span className={result.kind === "ok" ? "text-accent" : "text-red-400"}>
                [{result.kind === "ok" ? " OK " : " ERR "}] {result.message}
              </span>
            )}
          </p>
        </form>

        <section aria-labelledby="hof-title">
          <h3 id="hof-title" className="font-mono text-sm text-accent">
            Hall of Fame
          </h3>
          {board === null ? (
            <p className="mt-2 text-sm text-muted">carregando...</p>
          ) : board.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Ninguém ainda. Seja o primeiro nome aqui.</p>
          ) : (
            <table className="mt-2 w-full font-mono text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-normal">#</th>
                  <th className="py-1 font-normal">apelido</th>
                  <th className="py-1 font-normal">flags</th>
                  <th className="py-1 text-right font-normal">pts</th>
                </tr>
              </thead>
              <tbody>
                {board.map((e, i) => (
                  <tr key={e.nickname} className="border-t border-border">
                    <td className="py-1.5 text-muted">{i + 1}</td>
                    <td className="py-1.5">{e.nickname}</td>
                    <td className="py-1.5 text-muted">
                      {e.solved.length}/{challenges.length}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{e.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
