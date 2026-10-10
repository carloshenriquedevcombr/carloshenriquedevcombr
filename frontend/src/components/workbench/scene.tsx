"use client";

import { Edges, Html, Line, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PART_BY_ID, type PartId } from "./parts";

const ACCENT = "#39ff9c";
const ACCENT_2 = "#22d3ee";
const BOARD_TOP = 0.04;

export interface SceneProps {
  exploded: boolean;
  selected: PartId | null;
  onSelect: (id: PartId | null) => void;
  reducedMotion: boolean;
  active: boolean;
}

export default function WorkbenchScene(props: SceneProps) {
  const [degraded, setDegraded] = useState(false);

  return (
    <Canvas
      frameloop={props.active ? "always" : "never"}
      dpr={degraded ? 1 : [1, 2]}
      camera={{ position: [5.6, 4.4, 6.2], fov: 38 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
    >
      {/* Se o FPS cair, reduz a resolução e desliga o pós-processamento */}
      <PerformanceMonitor onDecline={() => setDegraded(true)} />
      <color attach="background" args={["#07090c"]} />
      <fog attach="fog" args={["#07090c", 9, 16]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <pointLight position={[-3, 2, -2]} intensity={3} color={ACCENT_2} distance={8} />

      <Device {...props} />

      <gridHelper args={[14, 28, "#123826", "#0c1a14"]} position={[0, -1.6, 0]} />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={!props.reducedMotion && props.selected === null}
        autoRotateSpeed={0.6}
        minPolarAngle={0.25}
        maxPolarAngle={1.45}
        target={[0, 0.35, 0]}
      />

      {!degraded && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
          <Vignette eskil={false} offset={0.2} darkness={0.75} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function Device({ exploded, selected, onSelect, reducedMotion }: SceneProps) {
  return (
    <group rotation={[0, -0.35, 0]}>
      {/* Carcaça inferior */}
      <Exploding offset={-1.1} exploded={exploded} reducedMotion={reducedMotion}>
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[4.3, 0.36, 2.9]} />
          <meshStandardMaterial color="#10161d" roughness={0.8} />
          <Edges color="#1f2a37" />
        </mesh>
      </Exploding>

      <Board />
      <Traces reducedMotion={reducedMotion} />
      <Leds reducedMotion={reducedMotion} />

      <Part id="mcu" position={[-0.75, 0, -0.2]} {...{ exploded, selected, onSelect, reducedMotion }}>
        <Mcu />
      </Part>
      <Part id="flash" position={[0.85, 0, -0.65]} {...{ exploded, selected, onSelect, reducedMotion }}>
        <FlashChip />
      </Part>
      <Part id="uart" position={[1.55, 0, 0.75]} {...{ exploded, selected, onSelect, reducedMotion }}>
        <UartHeader />
      </Part>
      <Part id="usb" position={[-1.82, 0, 0.75]} {...{ exploded, selected, onSelect, reducedMotion }}>
        <UsbPort />
      </Part>
      <Part id="antenna" position={[-0.75, 0, -1.05]} {...{ exploded, selected, onSelect, reducedMotion }}>
        <Antenna />
      </Part>

      {/* Tampa translúcida: ignora o raycast para não bloquear os componentes */}
      <Exploding offset={1.9} exploded={exploded} reducedMotion={reducedMotion}>
        <mesh position={[0, 0.42, 0]} raycast={() => null}>
          <boxGeometry args={[4.3, 0.6, 2.9]} />
          <meshStandardMaterial color={ACCENT_2} transparent opacity={0.05} depthWrite={false} />
          <Edges color={ACCENT_2} />
        </mesh>
      </Exploding>
    </group>
  );
}

/** Move o conteúdo em y entre a posição montada e a "explodida" com amortecimento. */
function Exploding({
  offset,
  exploded,
  reducedMotion,
  children,
}: {
  offset: number;
  exploded: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = exploded ? offset : 0;
    ref.current.position.y = reducedMotion
      ? target
      : THREE.MathUtils.damp(ref.current.position.y, target, 5, delta);
  });
  return <group ref={ref}>{children}</group>;
}

function Part({
  id,
  position,
  exploded,
  selected,
  onSelect,
  reducedMotion,
  children,
}: {
  id: PartId;
  position: [number, number, number];
  exploded: boolean;
  selected: PartId | null;
  onSelect: (id: PartId | null) => void;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const info = PART_BY_ID[id];
  const highlighted = hovered || selected === id;

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHovered(false);
    document.body.style.cursor = "";
  };

  return (
    <Exploding offset={info.explodeY} exploded={exploded} reducedMotion={reducedMotion}>
      <group
        position={position}
        onPointerOver={over}
        onPointerOut={out}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected === id ? null : id);
        }}
      >
        {children}
        {/* Marcador de seleção no "chão" do componente */}
        {highlighted && (
          <mesh position={[0, BOARD_TOP + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.56, 48]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
        )}
        {highlighted && (
          <Html position={[0, 0.55, 0]} center distanceFactor={5} zIndexRange={[20, 0]}>
            <span className="pointer-events-none rounded border border-accent/60 bg-background/90 px-2 py-0.5 font-mono text-[11px] whitespace-nowrap text-accent">
              {info.label}
            </span>
          </Html>
        )}
      </group>
    </Exploding>
  );
}

function Board() {
  return (
    <mesh>
      <boxGeometry args={[4, 0.08, 2.6]} />
      <meshStandardMaterial color="#0b3d2a" roughness={0.6} metalness={0.1} />
      <Edges color="#1d6b4a" />
    </mesh>
  );
}

function Mcu() {
  return (
    <group>
      {/* Blindagem metálica do módulo */}
      <mesh position={[0, BOARD_TOP + 0.08, 0.1]}>
        <boxGeometry args={[1.1, 0.14, 0.9]} />
        <meshStandardMaterial color="#8792a0" metalness={0.8} roughness={0.45} />
      </mesh>
      <mesh position={[0, BOARD_TOP + 0.03, -0.42]}>
        <boxGeometry args={[1.1, 0.04, 0.22]} />
        <meshStandardMaterial color="#123a2a" />
      </mesh>
    </group>
  );
}

function FlashChip() {
  const pins = [-0.12, -0.04, 0.04, 0.12];
  return (
    <group>
      <mesh position={[0, BOARD_TOP + 0.05, 0]}>
        <boxGeometry args={[0.42, 0.1, 0.32]} />
        <meshStandardMaterial color="#111" roughness={0.5} />
      </mesh>
      {pins.flatMap((x) =>
        [-0.2, 0.2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, BOARD_TOP + 0.02, z]}>
            <boxGeometry args={[0.04, 0.03, 0.08]} />
            <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.2} />
          </mesh>
        )),
      )}
      {/* Marca do pino 1 */}
      <mesh position={[-0.14, BOARD_TOP + 0.101, -0.09]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.025, 16]} />
        <meshBasicMaterial color="#555" />
      </mesh>
    </group>
  );
}

function UartHeader() {
  const pins = [-0.24, -0.08, 0.08, 0.24];
  return (
    <group>
      <mesh position={[0, BOARD_TOP + 0.06, 0]}>
        <boxGeometry args={[0.64, 0.12, 0.16]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {pins.map((x, i) => (
        <mesh key={x} position={[x, BOARD_TOP + 0.24, 0]}>
          <boxGeometry args={[0.04, 0.4, 0.04]} />
          <meshStandardMaterial
            color="#e2b84a"
            metalness={1}
            roughness={0.25}
            emissive={i === 1 ? ACCENT : "#000"}
            emissiveIntensity={i === 1 ? 0.6 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

function UsbPort() {
  return (
    <mesh position={[0, BOARD_TOP + 0.1, 0]}>
      <boxGeometry args={[0.4, 0.2, 0.5]} />
      <meshStandardMaterial color="#b8c0c8" metalness={0.95} roughness={0.25} />
    </mesh>
  );
}

function Antenna() {
  // Antena em zigue-zague desenhada na própria PCB
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const x = -0.45 + i * 0.1125;
      pts.push([x, BOARD_TOP + 0.01, i % 2 === 0 ? -0.08 : 0.08]);
    }
    return pts;
  }, []);
  return (
    <group>
      <mesh position={[0, BOARD_TOP + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.05, 0.3]} />
        <meshStandardMaterial color="#0e4a33" />
      </mesh>
      <Line points={points} color="#d4b25a" lineWidth={2.5} />
    </group>
  );
}

// Trilhas que ligam os componentes, por onde correm os "pulsos de dados"
const TRACE_PATHS: [number, number][][] = [
  [[-0.2, -0.1], [0.3, -0.1], [0.3, -0.65], [0.62, -0.65]],
  [[-0.2, 0.2], [0.9, 0.2], [0.9, 0.75], [1.3, 0.75]],
  [[-1.25, 0.25], [-1.25, 0.75], [-1.6, 0.75]],
  [[-0.2, 0.05], [0.6, 0.05], [1.1, -0.4], [1.75, -0.4], [1.75, 0.55]],
  [[-1.3, -0.2], [-1.7, -0.2], [-1.7, -1.0]],
];

function Traces({ reducedMotion }: { reducedMotion: boolean }) {
  const paths = useMemo(
    () =>
      TRACE_PATHS.map((p) => p.map(([x, z]) => new THREE.Vector3(x, BOARD_TOP + 0.003, z))),
    [],
  );
  return (
    <group>
      {paths.map((points, i) => (
        <group key={i}>
          <Line points={points} color="#2f8a63" lineWidth={1.5} />
          {!reducedMotion && <Pulse points={points} speed={0.55 + (i % 3) * 0.2} delay={i * 0.37} />}
        </group>
      ))}
    </group>
  );
}

function Pulse({ points, speed, delay }: { points: THREE.Vector3[]; speed: number; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }
    return path;
  }, [points]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * speed * 0.5 + delay) % 1;
    ref.current.position.copy(curve.getPointAt(t));
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.035, 12, 12]} />
      <meshBasicMaterial color={ACCENT} toneMapped={false} />
    </mesh>
  );
}

function Leds({ reducedMotion }: { reducedMotion: boolean }) {
  const activity = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (reducedMotion || !activity.current) return;
    // Pisca irregular, como um LED de atividade de rede
    const on = Math.sin(clock.elapsedTime * 9) + Math.sin(clock.elapsedTime * 3.3) > 0.4;
    activity.current.color.set(on ? ACCENT_2 : "#0b2a30");
  });
  return (
    <group>
      <mesh position={[1.6, BOARD_TOP + 0.03, -1.0]}>
        <boxGeometry args={[0.1, 0.06, 0.06]} />
        <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
      </mesh>
      <mesh position={[1.8, BOARD_TOP + 0.03, -1.0]}>
        <boxGeometry args={[0.1, 0.06, 0.06]} />
        <meshBasicMaterial ref={activity} color={ACCENT_2} toneMapped={false} />
      </mesh>
    </group>
  );
}
