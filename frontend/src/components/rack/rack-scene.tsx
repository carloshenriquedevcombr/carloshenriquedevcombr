"use client";

import { Edges, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MODE_COLOR, type LabMode } from "../terminal/types";
import { CanvasLabel } from "../three/canvas-label";

// Mesmos hosts do comando nmap (backend/app/terminal/commands.py)
export const RACK_UNITS = [
  { id: "gw", label: "gw · proxy", ip: "10.0.0.1", filtered: false },
  { id: "web", label: "web · next.js", ip: "10.0.0.10", filtered: false },
  { id: "api", label: "api · fastapi", ip: "10.0.0.20", filtered: false },
  { id: "db", label: "db · postgres", ip: "10.0.0.30", filtered: true },
  { id: "cache", label: "cache · redis", ip: "10.0.0.40", filtered: true },
] as const;

const UNIT_H = 0.42;
const SCAN_DURATION = 2.2;
const TOP_Y = 1.15;
const FILTERED = "#f59e0b";

export interface RackSceneProps {
  mode: LabMode;
  scanId: number;
  reducedMotion: boolean;
  active: boolean;
}

export default function RackScene({ mode, scanId, reducedMotion, active }: RackSceneProps) {
  const [degraded, setDegraded] = useState(false);
  const [glitch, setGlitch] = useState(false);

  // Troca de modo dispara um "glitch" curto de aberração cromática
  useEffect(() => {
    if (mode === "normal" || reducedMotion) return;
    const on = setTimeout(() => setGlitch(true), 0);
    const off = setTimeout(() => setGlitch(false), 450);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [mode, reducedMotion]);

  const color = MODE_COLOR[mode];

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={degraded ? 1 : [1, 2]}
      camera={{ position: [2.9, 1.0, 4.6], fov: 42 }}
      gl={{ antialias: true }}
    >
      <PerformanceMonitor onDecline={() => setDegraded(true)} />
      <color attach="background" args={["#05070a"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 4, 4]} intensity={1.1} />
      <pointLight position={[0, 0.5, 1.6]} intensity={4} distance={5} color={color} />

      <Rack mode={mode} scanId={scanId} reducedMotion={reducedMotion} />
      {(mode === "blue" || mode === "purple") && (
        <Shield color={color} reducedMotion={reducedMotion} />
      )}

      <gridHelper args={[10, 20, "#123826", "#0c1a14"]} position={[0, -1.3, 0]} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={1.0}
        maxPolarAngle={1.75}
        minAzimuthAngle={-0.9}
        maxAzimuthAngle={1.2}
      />

      {!degraded && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.2} luminanceThreshold={0.5} />
          <ChromaticAberration
            offset={new THREE.Vector2(glitch ? 0.012 : 0, glitch ? 0.006 : 0)}
            radialModulation={false}
            modulationOffset={0}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function Rack({ mode, scanId, reducedMotion }: { mode: LabMode; scanId: number; reducedMotion: boolean }) {
  const scanStart = useRef<number | null>(null);
  const laser = useRef<THREE.Mesh>(null);
  const [scanned, setScanned] = useState<Set<string>>(new Set());

  // Cada novo `nmap` reinicia a varredura
  useEffect(() => {
    if (scanId === 0) return;
    scanStart.current = null; // marcado no próximo frame com o relógio da cena
    const reset = setTimeout(() => setScanned(new Set()), 0);
    return () => clearTimeout(reset);
  }, [scanId]);

  useFrame(({ clock }) => {
    if (scanId === 0 || !laser.current) return;
    if (scanStart.current === null) scanStart.current = clock.elapsedTime;
    const progress = (clock.elapsedTime - scanStart.current) / (reducedMotion ? 0.01 : SCAN_DURATION);
    const done = progress >= 1;
    laser.current.visible = !done;
    const y = TOP_Y + 0.3 - Math.min(progress, 1) * (RACK_UNITS.length * UNIT_H + 0.4);
    laser.current.position.y = y;

    // Marca como "escaneado" cada servidor por onde o laser já passou
    const reached = RACK_UNITS.filter((_, i) => y < TOP_Y - i * UNIT_H).map((u) => u.id);
    if (reached.length !== scanned.size) setScanned(new Set(reached));
  });

  const color = MODE_COLOR[mode];

  return (
    <group>
      {/* Gabinete */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.5, 2.9, 1.3]} />
        <meshStandardMaterial color="#0b0f14" transparent opacity={0.35} depthWrite={false} />
        <Edges color="#2a3644" />
      </mesh>

      {RACK_UNITS.map((unit, i) => (
        <ServerUnit
          key={unit.id}
          index={i}
          label={unit.label}
          ip={unit.ip}
          filtered={unit.filtered}
          scanned={scanned.has(unit.id)}
          color={color}
          reducedMotion={reducedMotion}
        />
      ))}
      {/* Painel cego no último slot */}
      <mesh position={[0, TOP_Y - RACK_UNITS.length * UNIT_H, 0]}>
        <boxGeometry args={[1.3, UNIT_H - 0.06, 1.1]} />
        <meshStandardMaterial color="#0d1117" roughness={0.9} />
      </mesh>

      {/* Laser de varredura */}
      <mesh ref={laser} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 1.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ServerUnit({
  index,
  label,
  ip,
  filtered,
  scanned,
  color,
  reducedMotion,
}: {
  index: number;
  label: string;
  ip: string;
  filtered: boolean;
  scanned: boolean;
  color: string;
  reducedMotion: boolean;
}) {
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const y = TOP_Y - index * UNIT_H;
  const highlight = scanned ? (filtered ? FILTERED : color) : null;

  useFrame(({ clock }) => {
    if (!led.current) return;
    const t = clock.elapsedTime * (5 + index) + index * 1.7;
    const on = reducedMotion || Math.sin(t) + Math.sin(t * 0.37) > 0.3;
    led.current.color.set(on ? color : "#0b1a12");
  });

  return (
    <group position={[0, y, 0]}>
      <mesh>
        <boxGeometry args={[1.3, UNIT_H - 0.06, 1.1]} />
        <meshStandardMaterial color="#141b23" metalness={0.6} roughness={0.5} />
        <Edges color={highlight ?? "#26313d"} />
      </mesh>
      {/* LED de atividade + LED de estado do scan */}
      <mesh position={[0.45, 0.06, 0.556]}>
        <boxGeometry args={[0.05, 0.03, 0.01]} />
        <meshBasicMaterial ref={led} color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0.55, 0.06, 0.556]}>
        <boxGeometry args={[0.05, 0.03, 0.01]} />
        <meshBasicMaterial color={highlight ?? "#1a222b"} toneMapped={false} />
      </mesh>
      {/* Etiqueta impressa no painel frontal */}
      <CanvasLabel
        position={[-0.2, 0, 0.552]}
        title={label}
        subtitle={scanned ? `${ip} · ${filtered ? "filtered" : "open"}` : ""}
        color={highlight ?? "#7d8b99"}
      />
    </group>
  );
}

function Shield({ color, reducedMotion }: { color: string; reducedMotion: boolean }) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.opacity = reducedMotion ? 0.08 : 0.05 + (Math.sin(clock.elapsedTime * 2.5) + 1) * 0.04;
  });
  return (
    <mesh position={[0, 0.1, 0]}>
      <boxGeometry args={[1.9, 3.3, 1.7]} />
      <meshBasicMaterial ref={material} color={color} transparent opacity={0.08} depthWrite={false} toneMapped={false} />
      <Edges color={color} />
    </mesh>
  );
}
