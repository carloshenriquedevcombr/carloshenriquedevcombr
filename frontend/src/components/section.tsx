import type { ReactNode } from "react";

export function Section({
  id,
  index,
  title,
  subtitle,
  children,
}: {
  id: string;
  index: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <p className="font-mono text-xs tracking-widest text-accent">{index}</p>
        <h2 id={`${id}-title`} className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="mt-3 max-w-2xl text-muted">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
