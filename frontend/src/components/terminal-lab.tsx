"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useWideScreen } from "@/lib/hooks";
import { Terminal } from "./terminal/terminal";
import { MODE_COLOR, type LabMode, type TerminalEvent } from "./terminal/types";

const RackScene = dynamic(() => import("./rack/rack-scene"), {
  ssr: false,
  loading: () => (
    <p className="cursor-blink p-4 font-mono text-xs text-muted">carregando rack</p>
  ),
});

const MODE_CAPTION: Record<LabMode, string> = {
  normal: "rack-01 · 5 hosts · rode 'nmap lab.local'",
  red: "RED TEAM · superfície de ataque em análise",
  blue: "BLUE TEAM · escudos e monitoramento ativos",
  purple: "PURPLE TEAM · ataque ↔ detecção",
};

export function TerminalLab() {
  const [mode, setMode] = useState<LabMode>("normal");
  const [scanId, setScanId] = useState(0);
  const wide = useWideScreen();
  const reducedMotion = useReducedMotion();
  const rackBox = useRef<HTMLDivElement>(null);
  const [rackVisible, setRackVisible] = useState(true);

  useEffect(() => {
    const el = rackBox.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setRackVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [wide]);

  const onEvent = (event: TerminalEvent) => {
    if (event.type === "scan") setScanId((n) => n + 1);
    if (event.type === "mode") setMode(event.mode);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <Terminal mode={mode} onEvent={onEvent} />
      {wide && (
        <div
          ref={rackBox}
          className="relative h-[460px] overflow-hidden rounded-lg border bg-[#05070a] transition-colors"
          style={{ borderColor: `${MODE_COLOR[mode]}44` }}
        >
          <RackScene mode={mode} scanId={scanId} reducedMotion={reducedMotion} active={rackVisible} />
          <p
            className="pointer-events-none absolute top-3 left-3 font-mono text-[10px]"
            style={{ color: MODE_COLOR[mode] }}
          >
            {MODE_CAPTION[mode]}
          </p>
        </div>
      )}
    </div>
  );
}
