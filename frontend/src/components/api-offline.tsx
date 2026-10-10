export function ApiOffline({ what }: { what: string }) {
  return (
    <div
      role="status"
      className="rounded border border-red-500/40 bg-red-500/5 p-4 font-mono text-sm text-red-300"
    >
      [ ERR ] Não foi possível carregar {what}: a API do laboratório está offline. Tente
      novamente em instantes.
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <p role="status" className="cursor-blink font-mono text-sm text-muted">
      carregando {label}
    </p>
  );
}
