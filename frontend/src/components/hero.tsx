import Link from "next/link";
import { site } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-mono text-sm text-muted">
            <span className="text-accent">$</span> whoami
          </p>
          <h1 className="glow mt-4 text-5xl font-bold tracking-tight sm:text-6xl">{site.name}</h1>
          <p className="mt-4 font-mono text-lg text-accent-2">
            {site.role} <span className="text-muted">|</span> {site.tagline}
          </p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Eu resolvia problemas um chamado por vez. Hoje construo sistemas que eliminam os
            chamados — com Python, dados e segurança desde o design.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/#projetos"
              className="rounded bg-accent px-5 py-2.5 font-mono text-sm font-semibold text-black hover:bg-accent/90"
            >
              ./ver-projetos
            </Link>
            <Link
              href="/resume"
              className="rounded border border-border px-5 py-2.5 font-mono text-sm hover:border-accent hover:text-accent"
            >
              cat curriculo.txt
            </Link>
          </div>
        </div>

        {/* Placeholder da cena 3D (Workbench) que chega na Fase 2 */}
        <div
          aria-hidden="true"
          className="relative hidden aspect-square overflow-hidden rounded-lg border border-border bg-surface/60 md:block"
        >
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
          <p className="absolute bottom-3 left-3 font-mono text-[10px] text-muted">
            workbench.glb · loading in phase 2
          </p>
        </div>
      </div>
    </section>
  );
}
