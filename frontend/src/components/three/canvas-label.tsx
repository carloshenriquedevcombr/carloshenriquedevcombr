"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * Texto desenhado num canvas e aplicado como textura num plano: fica dentro do
 * WebGL (sem DOM sobreposto), então gira e é ocultado junto com a cena.
 */
export function CanvasLabel({
  position,
  title,
  subtitle = "",
  color,
  width = 0.8,
  align = "left",
}: {
  position: [number, number, number];
  title: string;
  subtitle?: string;
  color: string;
  width?: number;
  align?: CanvasTextAlign;
}) {
  // Recriada só quando o texto ou a cor mudam
  const texture = useMemo(
    () => drawLabel(title, subtitle, color, align),
    [title, subtitle, color, align],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, width / 4]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function drawLabel(
  title: string,
  subtitle: string,
  color: string,
  align: CanvasTextAlign,
): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const x = align === "center" ? W / 2 : 8;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.font = "600 40px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(title, x, subtitle ? 38 : 64);
    if (subtitle) {
      ctx.globalAlpha = 0.8;
      ctx.font = "34px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(subtitle, x, 92);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
