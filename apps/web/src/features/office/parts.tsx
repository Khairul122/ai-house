import type { ThreeElements } from "@react-three/fiber";
import React from "react";
import { BoxGeometry, type Mesh, MeshStandardMaterial } from "three";

export type V3 = [number, number, number];

interface BoxProps extends Omit<ThreeElements["mesh"], "args"> {
  p?: V3;
  s: V3;
  c: string;
  emissive?: string;
  glow?: number;
  shadow?: boolean;
}

// Geometri dan material dipakai bersama antar kotak yang sama ukuran/warnanya.
// Ribuan kotak voxel jadi hanya puluhan objek GPU, dan tidak dibuat ulang setiap render.
const geometries = new Map<string, BoxGeometry>();
const materials = new Map<string, MeshStandardMaterial>();

function geometryFor(s: V3) {
  const key = s.join(",");
  let g = geometries.get(key);
  if (!g) {
    g = new BoxGeometry(...s);
    geometries.set(key, g);
  }
  return g;
}

export function materialFor(color: string, emissive = "#000000", glow = 0) {
  const key = `${color}|${emissive}|${glow}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, emissive, emissiveIntensity: glow, roughness: 0.85 });
    materials.set(key, m);
  }
  return m;
}

// Satu kotak voxel. Semua furnitur dan karakter dibangun dari ini.
// Kotak kecil (mata, buku, detail) tidak ikut menghasilkan bayangan: tak terlihat, tapi mahal.
export const Box = React.forwardRef<Mesh, BoxProps>(function Box({ p, s, c, emissive, glow = 0, shadow = true, ...rest }, ref) {
  const casts = shadow && Math.max(s[0], s[1], s[2]) >= 0.35;
  return (
    <mesh
      ref={ref}
      position={p}
      castShadow={casts}
      receiveShadow
      geometry={geometryFor(s)}
      material={materialFor(c, emissive ?? "#000000", glow)}
      {...rest}
    />
  );
});
