import type { ThreeElements } from "@react-three/fiber";
import React from "react";
import type { Mesh } from "three";

export type V3 = [number, number, number];

interface BoxProps extends Omit<ThreeElements["mesh"], "args"> {
  p?: V3;
  s: V3;
  c: string;
  emissive?: string;
  glow?: number;
  shadow?: boolean;
}

// Satu kotak voxel. Semua furnitur dan karakter dibangun dari ini.
export const Box = React.forwardRef<Mesh, BoxProps>(function Box(
  { p, s, c, emissive, glow = 0, shadow = true, ...rest },
  ref
) {
  return (
    <mesh ref={ref} position={p} castShadow={shadow} receiveShadow {...rest}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={emissive ?? "#000000"} emissiveIntensity={glow} roughness={0.85} />
    </mesh>
  );
});
