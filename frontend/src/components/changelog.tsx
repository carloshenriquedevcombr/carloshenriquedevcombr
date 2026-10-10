import type { TimelineEntry } from "@/lib/api";

export function Changelog({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-10 border-l border-border pl-8">
      {entries.map((entry, i) => {
        const current = i === entries.length - 1;
        return (
          <li key={entry.version} className="relative">
            <span
              aria-hidden="true"
              className={`absolute top-1 -left-[41px] h-4 w-4 rounded-full border-2 ${
                current
                  ? "border-accent bg-accent shadow-[0_0_12px_var(--accent)]"
                  : "border-muted bg-background"
              }`}
            />
            <p className="font-mono text-sm">
              <span className="text-accent">{entry.version}</span>
              <span className="text-muted"> · {entry.period}</span>
              {current && <span className="ml-2 text-accent-2">(HEAD)</span>}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{entry.title}</h3>
            <p className="mt-2 max-w-2xl text-muted">{entry.description}</p>
            <ul className="mt-3 space-y-1 font-mono text-sm">
              {entry.highlights.map((h) => (
                <li key={h}>
                  <span className="text-accent">+</span> {h}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
