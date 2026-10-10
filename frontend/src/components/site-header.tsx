import Link from "next/link";
import { PUBLIC_API_URL } from "@/lib/api";

const NAV = [
  { href: "/#origem", label: "Origem" },
  { href: "/#skills", label: "Skills" },
  { href: "/#projetos", label: "Projetos" },
  { href: "/#terminal", label: "Terminal" },
  { href: "/#contato", label: "Contato" },
];

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-mono text-sm text-accent">
          ~/the-lab<span className="text-muted">$</span>
        </Link>
        <nav aria-label="Principal" className="hidden gap-6 font-mono text-sm text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <a href={`${PUBLIC_API_URL}/docs`} className="hover:text-foreground">
            API
          </a>
        </nav>
        <Link
          href="/resume"
          className="rounded border border-accent/60 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/10"
        >
          Pular para o CV →
        </Link>
      </div>
    </header>
  );
}
