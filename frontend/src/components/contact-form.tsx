"use client";

import { useState } from "react";
import { PUBLIC_API_URL } from "@/lib/api";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setState({ kind: "sending" });

    try {
      // O navegador fala direto com a API para que o rate limit veja o IP real do visitante
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 202) {
        form.reset();
        setState({ kind: "sent" });
      } else if (res.status === 429) {
        setState({ kind: "error", message: "Muitas mensagens em pouco tempo. Tente mais tarde." });
      } else if (res.status === 422) {
        setState({ kind: "error", message: "Confira os campos: e-mail válido e mensagem com 10+ caracteres." });
      } else {
        setState({ kind: "error", message: `Erro inesperado (${res.status}).` });
      }
    } catch {
      setState({ kind: "error", message: "Não foi possível falar com a API. Tente novamente." });
    }
  }

  const input =
    "mt-1 w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent";

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <div>
        <label htmlFor="name" className="font-mono text-xs text-muted">
          nome
        </label>
        <input id="name" name="name" required minLength={2} maxLength={100} className={input} />
      </div>
      <div>
        <label htmlFor="email" className="font-mono text-xs text-muted">
          email
        </label>
        <input id="email" name="email" type="email" required maxLength={254} className={input} />
      </div>
      <div>
        <label htmlFor="message" className="font-mono text-xs text-muted">
          mensagem
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          className={input}
        />
      </div>
      {/* Honeypot: invisível para humanos e leitores de tela; bots costumam preencher */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Não preencha este campo</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="rounded bg-accent px-5 py-2.5 font-mono text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-60"
      >
        {state.kind === "sending" ? "transmitindo..." : "./enviar --handshake"}
      </button>

      <p aria-live="polite" className="min-h-5 font-mono text-sm">
        {state.kind === "sent" && (
          <span className="text-accent">[ OK ] Mensagem recebida. Respondo em breve!</span>
        )}
        {state.kind === "error" && <span className="text-red-400">[ ERR ] {state.message}</span>}
      </p>
    </form>
  );
}
