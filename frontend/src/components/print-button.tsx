"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded border border-accent/60 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/10"
    >
      salvar como PDF
    </button>
  );
}
