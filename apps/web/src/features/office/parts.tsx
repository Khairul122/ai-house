import type { ThreeElements } from "@react-three/fiber";
import React from "react";
import { BoxGeometry, type BufferGeometry, type Mesh, MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];

interface BoxProps extends Omit<ThreeElements["mesh"], "args"> {
  p?: V3;
  s: V3;
  c: string;
  emissive?: string;
  glow?: number;
  shadow?: boolean;
  /** sudut membulat (bawaan). false untuk pelat tipis atau sambungan yang harus rapat */
  round?: boolean;
}

// Geometri dan material dipakai bersama antar kotak yang sama ukuran/warnanya.
// Ribuan kotak jadi hanya puluhan objek GPU, dan tidak dibuat ulang setiap render.
const geometries = new Map<string, BufferGeometry>();
const materials = new Map<string, MeshStandardMaterial>();

// Gaya diorama: setiap kotak bersudut bulat. Jari-jari mengikuti sisi terpendek (maks 0,08)
// sehingga meja tetap tegas dan kepala karakter terasa lembut. Kotak sangat tipis tetap tajam.
function geometryFor(s: V3, round: boolean) {
  const min = Math.min(s[0], s[1], s[2]);
  const radius = round && min >= 0.04 ? Math.min(0.08, min * 0.22) : 0;
  const key = `${s.join(",")}|${radius.toFixed(3)}`;
  let g = geometries.get(key);
  if (!g) {
    g = radius > 0 ? new RoundedBoxGeometry(s[0], s[1], s[2], 2, radius) : new BoxGeometry(...s);
    geometries.set(key, g);
  }
  return g;
}

export function materialFor(color: string, emissive = "#000000", glow = 0) {
  const key = `${color}|${emissive}|${glow}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, emissive, emissiveIntensity: glow, roughness: 0.72 });
    materials.set(key, m);
  }
  return m;
}

// Satu kotak. Semua furnitur, bangunan, dan karakter dibangun dari ini.
// Kotak kecil (mata, buku, detail) tidak ikut menghasilkan bayangan: tak terlihat, tapi mahal.
export const Box = React.forwardRef<Mesh, BoxProps>(function Box({ p, s, c, emissive, glow = 0, shadow = true, round = true, ...rest }, ref) {
  const casts = shadow && Math.max(s[0], s[1], s[2]) >= 0.35;
  return (
    <mesh
      ref={ref}
      position={p}
      castShadow={casts}
      receiveShadow
      geometry={geometryFor(s, round)}
      material={materialFor(c, emissive ?? "#000000", glow)}
      {...rest}
    />
  );
});
