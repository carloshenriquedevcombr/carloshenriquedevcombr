"use client";

import { Edges, Line, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { PipelineSource } from "@/lib/api";
import { CanvasLabel } from "../three/canvas-label";

export interface Spawn {
  source: PipelineSource;
  malicious: boolean;
}

export const SOURCE_COLOR: Record<PipelineSource, string> = {
  http: "#39ff9c",
  terminal: "#22d3ee",
  contact: "#a78bfa",
  ctf: "#a78bfa",
};
const MALICIOUS = "#ff4d5e";

const SOURCE_POS: Record<PipelineSource, THREE.Vector3> = {
  http: new THREE.Vector3(-4.2, 1.1, 0),
  terminal: new THREE.Vector3(-4.2, 0, 0),
  contact: new THREE.Vector3(-4.2, -1.1, 0),
  ctf: new THREE.Vector3(-4.2, -1.1, 0),
};
const EXTRACT = new THREE.Vector3(-1.9, 0, 0);
const TRANSFORM = new THREE.Vector3(0.4, 0, 0);
const LOAD = new THREE.Vector3(2.9, 0, 0);
const SIEM = new THREE.Vector3(0.4, -1.9, 0);

const MAX_PARTICLES = 400;
const SPEED = 2.2; // unidades por segundo

interface Particle {
  path: THREE.Vector3[];
  lengths: number[];
  total: number;
  travelled: number;
  malicious: boolean;
}

export interface ReactorSceneProps {
  queue: RefObject<Spawn[]>;
  loaded: number;
  alertTick: number;
  reducedMotion: boolean;
  active: boolean;
}

export default function ReactorScene(props: ReactorSceneProps) {
  const [degraded, setDegraded] = useState(false);
  return (
    <Canvas
      frameloop={props.active ? "always" : "never"}
      dpr={degraded ? 1 : [1, 2]}
      camera={{ position: [0.6, 1.4, 7.4], fov: 45 }}
      gl={{ antialias: true }}
    >
      <PerformanceMonitor onDecline={() => setDegraded(true)} />
      <color attach="background" args={["#05070a"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 4, 5]} intensity={1} />

      <Pipes />
      <Nodes loaded={props.loaded} alertTick={props.alertTick} reducedMotion={props.reducedMotion} />
      <Particles queue={props.queue} reducedMotion={props.reducedMotion} />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={1.1}
        maxPolarAngle={1.75}
        minAzimuthAngle={-0.6}
        maxAzimuthAngle={0.6}
        target={[-0.4, -0.2, 0]}
      />
      {!degraded && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.2} luminanceThreshold={0.45} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function routeFor(source: PipelineSource, malicious: boolean): THREE.Vector3[] {
  return [SOURCE_POS[source], EXTRACT, TRANSFORM, malicious ? SIEM : LOAD];
}

function Pipes() {
  const sources: PipelineSource[] = ["http", "terminal", "contact"];
  return (
    <group>
      {sources.map((s) => (
        <Line key={s} points={[SOURCE_POS[s], EXTRACT]} color="#1d3b2c" lineWidth={1.5} />
      ))}
      <Line points={[EXTRACT, TRANSFORM, LOAD]} color="#1d3b2c" lineWidth={2} />
      <Line points={[TRANSFORM, SIEM]} color="#4a1d24" lineWidth={2} dashed dashSize={0.12} gapSize={0.08} />
    </group>
  );
}

function Nodes({ loaded, alertTick, reducedMotion }: { loaded: number; alertTick: number; reducedMotion: boolean }) {
  const transform = useRef<THREE.Mesh>(null);
  const extract = useRef<THREE.Mesh>(null);
  const siem = useRef<THREE.MeshBasicMaterial>(null);
  const alertAt = useRef<{ tick: number; time: number }>({ tick: 0, time: -10 });
  const fill = Math.min(1, Math.log10(loaded + 1) / 4); // 10^4 eventos = cubo cheio

  useFrame(({ clock }, delta) => {
    if (!reducedMotion) {
      if (transform.current) transform.current.rotation.x += delta * 0.8;
      if (extract.current) extract.current.rotation.y += delta * 0.6;
    }
    if (alertAt.current.tick !== alertTick) alertAt.current = { tick: alertTick, time: clock.elapsedTime };
    if (siem.current) {
      // O SIEM pisca em vermelho a cada novo alerta e volta ao repouso
      const k = Math.max(0, 1 - (clock.elapsedTime - alertAt.current.time) / 1.2);
      siem.current.color.set("#5a1f27").lerp(new THREE.Color(MALICIOUS), k);
    }
  });

  return (
    <group>
      {(["http", "terminal", "contact"] as const).map((s) => (
        <group key={s} position={SOURCE_POS[s]}>
          <mesh>
            <boxGeometry args={[0.36, 0.36, 0.36]} />
            <meshStandardMaterial color="#0d1117" />
            <Edges color={SOURCE_COLOR[s]} />
          </mesh>
          <CanvasLabel
            position={[0, 0.42, 0]}
            title={s === "http" ? "HTTP" : s === "terminal" ? "TERMINAL" : "CTF · CONTATO"}
            color={SOURCE_COLOR[s]}
            width={1.3}
            align="center"
          />
        </group>
      ))}

      <group position={EXTRACT}>
        <mesh ref={extract}>
          <octahedronGeometry args={[0.42]} />
          <meshBasicMaterial color="#39ff9c" wireframe />
        </mesh>
        <CanvasLabel position={[0, 0.75, 0]} title="EXTRACT" color="#39ff9c" width={1.2} align="center" />
      </group>

      <group position={TRANSFORM}>
        <mesh ref={transform}>
          <torusGeometry args={[0.42, 0.06, 12, 40]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
        <CanvasLabel position={[0, 0.75, 0]} title="TRANSFORM" subtitle="regras de detecção" color="#22d3ee" width={1.4} align="center" />
      </group>

      <group position={LOAD}>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color="#0b1a12" transparent opacity={0.4} />
          <Edges color="#39ff9c" />
        </mesh>
        {/* Nível do "data lake": cresce em escala log com os eventos carregados */}
        <mesh position={[0, -0.45 + (0.9 * fill) / 2, 0]} scale={[1, Math.max(fill, 0.001), 1]}>
          <boxGeometry args={[0.84, 0.9, 0.84]} />
          <meshBasicMaterial color="#39ff9c" transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <CanvasLabel position={[0, 0.8, 0]} title="LOAD" subtitle={`${loaded} eventos`} color="#39ff9c" width={1.2} align="center" />
      </group>

      <group position={SIEM}>
        <mesh>
          <icosahedronGeometry args={[0.38, 0]} />
          <meshBasicMaterial ref={siem} color="#5a1f27" wireframe toneMapped={false} />
        </mesh>
        <CanvasLabel position={[1.05, 0, 0]} title="SIEM" subtitle="quarentena" color={MALICIOUS} width={1.1} />
      </group>
    </group>
  );
}

function Particles({ queue, reducedMotion }: { queue: RefObject<Spawn[]>; reducedMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<(Particle | null)[]>(Array(MAX_PARTICLES).fill(null));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const pool = particles.current;

    // Novos eventos viram partículas
    for (const spawn of queue.current.splice(0, 40)) {
      const slot = pool.findIndex((p) => p === null);
      if (slot === -1) break;
      const path = routeFor(spawn.source, spawn.malicious);
      const lengths = path.slice(1).map((p, i) => p.distanceTo(path[i]));
      pool[slot] = {
        path,
        lengths,
        total: lengths.reduce((a, b) => a + b, 0),
        travelled: 0,
        malicious: spawn.malicious,
      };
      m.setColorAt(slot, color.set(spawn.malicious ? MALICIOUS : SOURCE_COLOR[spawn.source]));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    pool.forEach((p, i) => {
      if (!p) {
        dummy.scale.setScalar(0);
      } else {
        p.travelled += delta * (reducedMotion ? SPEED * 4 : SPEED);
        if (p.travelled >= p.total) {
          pool[i] = null;
          dummy.scale.setScalar(0);
        } else {
          // Posição ao longo da polilinha
          let d = p.travelled;
          let seg = 0;
          while (d > p.lengths[seg]) d -= p.lengths[seg++];
          point.lerpVectors(p.path[seg], p.path[seg + 1], d / p.lengths[seg]);
          dummy.position.copy(point);
          dummy.scale.setScalar(p.malicious ? 1.4 : 1);
        }
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <sphereGeometry args={[0.06, 10, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
