const LINES = [
  "LAB-BIOS v2.0 · POST check...",
  "[ OK ] Memory test ........ 16384 MB",
  "[ OK ] Mounting /projects",
  "[ OK ] Starting api.service (FastAPI)",
  "[ OK ] Firewall rules loaded",
  "Initializing Lab... ready.",
];

// Overlay puramente em CSS: não bloqueia a renderização nem depende de JS.
// Some sozinho após ~2s e é desligado com prefers-reduced-motion.
export function BootSequence() {
  return (
    <div
      aria-hidden="true"
      className="boot-overlay no-print pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <div className="w-full max-w-md px-6 font-mono text-sm text-accent">
        {LINES.map((line, i) => (
          <p key={line} className="boot-line" style={{ animationDelay: `${i * 0.25}s` }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
