import Link from "next/link";
import { site } from "@/lib/site";
import { Workbench } from "./workbench/workbench";

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

        <Workbench />
      </div>
    </section>
  );
}
