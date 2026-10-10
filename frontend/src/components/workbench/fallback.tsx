/** Versão 2D da bancada: usada enquanto a cena carrega e quando não há WebGL. */
export function WorkbenchFallback({ note }: { note: string }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 opacity-40">
        {Array.from({ length: 64 }, (_, i) => (
          <div key={i} className="border-[0.5px] border-accent/10" />
        ))}
      </div>
      <div className="absolute top-1/2 left-1/2 h-40 w-56 -translate-x-1/2 -translate-y-1/2 rounded-md border border-accent/50 bg-background/80 shadow-[0_0_40px_rgb(57_255_156/0.15)]">
        <div className="absolute top-4 left-4 h-10 w-10 rounded-sm border border-accent-2/60" />
        <div className="absolute top-4 right-4 h-6 w-16 rounded-sm border border-accent/40" />
        <div className="absolute right-6 bottom-6 left-6 h-px bg-accent/40" />
        <div className="absolute right-6 bottom-10 left-20 h-px bg-accent-2/40" />
      </div>
      <div className="scan absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-transparent via-accent/10 to-transparent" />
      <p className="absolute bottom-3 left-3 font-mono text-[10px] text-muted">{note}</p>
    </div>
  );
}
