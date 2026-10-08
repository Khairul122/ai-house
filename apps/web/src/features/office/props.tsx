import { MeshStandardMaterial } from "three";
import { MAT } from "./looks.ts";
import type { V3 } from "./parts.tsx";

// Kaca bening kebiruan untuk dinding ruangan. Satu material untuk semua panel kaca,
// tidak menulis depth agar isi ruangan tetap terlihat dari sisi mana pun.
export const glassMaterial = new MeshStandardMaterial({
  color: MAT.glass,
  transparent: true,
  opacity: 0.2,
  roughness: 0.08,
  metalness: 0,
  depthWrite: false,
});

// Tanaman besar dalam pot bulat: daun dari bola low-poly agar terasa seperti maket.
export function BigPlant({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.6, 16]} />
        <meshStandardMaterial color={MAT.pot} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={MAT.plant} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.22, 1.45, 0.1]} castShadow>
        <icosahedronGeometry args={[0.36, 0]} />
        <meshStandardMaterial color="#79C189" roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

// Bean bag bulat.
export function BeanBag({ p, c }: { p: V3; c: string }) {
  return (
    <group position={p}>
      <mesh
        position={[0, 0.2, 0]}
        scale={[1, 0.62, 1]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.36, 16, 10]} />
        <meshStandardMaterial color={c} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.36, -0.12]} scale={[0.9, 0.55, 0.6]}>
        <sphereGeometry args={[0.3, 14, 8]} />
        <meshStandardMaterial color={c} roughness={0.9} />
      </mesh>
    </group>
  );
}

// Karpet bundar tipis.
export function RoundRug({ p, r, c }: { p: V3; r: number; c: string }) {
  return (
    <mesh position={p} receiveShadow>
      <cylinderGeometry args={[r, r, 0.02, 32]} />
      <meshStandardMaterial color={c} roughness={0.95} />
    </mesh>
  );
}
