"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion, useWideScreen } from "@/lib/hooks";
import { WorkbenchFallback } from "./fallback";
import { PARTS, PART_BY_ID, type PartId } from "./parts";

// A cena só existe no navegador e fica num chunk separado (three.js é pesado)
const WorkbenchScene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <WorkbenchFallback note="workbench · carregando cena 3D..." />,
});

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const noop = () => () => {};

/** Bancada 3D do hero. Só é montada em telas md+ (no celular nem baixa o three.js). */
export function Workbench() {
  const wide = useWideScreen();
  return wide ? <WorkbenchPanel /> : null;
}

function WorkbenchPanel() {
  const reducedMotion = useReducedMotion();
  // null no servidor: decide entre 3D e fallback só no cliente
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);

  const [exploded, setExploded] = useState(false);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [active, setActive] = useState(true);
  const container = useRef<HTMLDivElement>(null);

  // Pausa a renderização quando a bancada sai da tela (economiza GPU e bateria)
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const info = selected ? PART_BY_ID[selected] : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={container}
        className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface/60"
      >
        {webgl === false ? (
          <WorkbenchFallback note="workbench · WebGL indisponível neste navegador" />
        ) : webgl ? (
          <WorkbenchScene
            exploded={exploded}
            selected={selected}
            onSelect={setSelected}
            reducedMotion={reducedMotion}
            active={active}
          />
        ) : (
          <WorkbenchFallback note="workbench · inicializando..." />
        )}

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <p className="font-mono text-[10px] leading-relaxed text-muted">
            LAB-01 · IoT target
            <br />
            arraste para girar · clique nos componentes
          </p>
          <button
            type="button"
            onClick={() => setExploded((v) => !v)}
            aria-pressed={exploded}
            className="pointer-events-auto rounded border border-accent/60 bg-background/80 px-2.5 py-1 font-mono text-[11px] text-accent hover:bg-accent/10"
          >
            {exploded ? "./montar" : "./desmontar"}
          </button>
        </div>

        {info && (
          <div
            role="dialog"
            aria-label={info.label}
            className="absolute inset-x-3 bottom-3 rounded border border-accent/50 bg-background/90 p-3 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-xs text-accent">
                [{info.tag}] {info.label}
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Fechar"
                className="font-mono text-xs text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{info.description}</p>
            {info.href && (
              <Link href={info.href} className="mt-2 inline-block font-mono text-xs text-accent-2 hover:underline">
                ver projeto relacionado →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Alternativa acessível ao clique na cena: mesmos componentes como botões */}
      <div role="group" aria-label="Componentes da placa" className="flex flex-wrap gap-1.5">
        {PARTS.map((part) => (
          <button
            key={part.id}
            type="button"
            aria-pressed={selected === part.id}
            onClick={() => setSelected(selected === part.id ? null : part.id)}
            className={`rounded border px-2 py-0.5 font-mono text-[11px] transition ${
              selected === part.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {part.tag}
          </button>
        ))}
      </div>
    </div>
  );
}
