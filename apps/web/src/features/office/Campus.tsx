import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { ExtrudeGeometry, type Mesh, type MeshStandardMaterial, Shape } from "three";
import { atmo } from "./Atmosphere.tsx";
import { CAMPUS_HALF_X, CAMPUS_HALF_Z, LEISURE, LIBRARY, PARK, PLAZA_Z, POOL, PROMENADE_Z, RING_X, WORSHIP, WORSHIP_Z } from "./layout.ts";
import { MAT } from "./looks.ts";
import { Monument } from "./Monument.tsx";
import { Box, type V3 } from "./parts.tsx";

const GRASS = "#A7B88A";
const PAVE = "#D9CFBC";
const GOLD = "#C9A227";

function Sign({ p, text }: { p: V3; text: string }) {
  return (
    <Html position={p} center zIndexRange={[10, 0]} pointerEvents="none">
      <div className="room-sign">{text}</div>
    </Html>
  );
}

// Atap pelana: prisma segitiga selebar w, setinggi h, sepanjang d (sumbu z).
function Gable({ p, w, h, d, c }: { p: V3; w: number; h: number; d: number; c: string }) {
  const geo = useMemo(() => {
    const s = new Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  }, [w, h, d]);
  return (
    <mesh position={p} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}

function Cross({ p, c = "#3B2E24", s = 1 }: { p: V3; c?: string; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Box p={[0, 0, 0]} s={[0.14, 1.2, 0.14]} c={c} />
      <Box p={[0, 0.2, 0]} s={[0.7, 0.14, 0.14]} c={c} />
    </group>
  );
}

function Tree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Box p={[0, 0.7, 0]} s={[0.3, 1.4, 0.3]} c="#7A5638" />
      <Box p={[0, 1.8, 0]} s={[1.5, 1.2, 1.5]} c="#6E8F57" />
      <Box p={[0.1, 2.6, -0.05]} s={[1, 0.8, 1]} c="#7FA164" />
    </group>
  );
}

function Masjid() {
  return (
    <group>
      <Box p={[0, 1.5, 0]} s={[7, 3, 6]} c="#EFE9DA" />
      <Box p={[0, 3.1, 0]} s={[7.2, 0.25, 6.2]} c="#2F6B4F" />
      <mesh position={[0, 3.25, 0]} castShadow>
        <cylinderGeometry args={[1.8, 1.8, 0.5, 24]} />
        <meshStandardMaterial color="#EFE9DA" />
      </mesh>
      <mesh position={[0, 3.5, 0]} castShadow>
        <sphereGeometry args={[1.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3E7C5E" roughness={0.6} />
      </mesh>
      <Box p={[0, 5.55, 0]} s={[0.1, 0.5, 0.1]} c={GOLD} />
      <mesh position={[0, 5.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.2, 0.05, 6, 16, Math.PI * 1.3]} />
        <meshStandardMaterial color={GOLD} />
      </mesh>
      {/* menara */}
      <mesh position={[4.2, 3.6, -2.4]} castShadow>
        <cylinderGeometry args={[0.45, 0.5, 7.2, 12]} />
        <meshStandardMaterial color="#EFE9DA" />
      </mesh>
      <mesh position={[4.2, 5.8, -2.4]}>
        <cylinderGeometry args={[0.7, 0.7, 0.2, 12]} />
        <meshStandardMaterial color="#2F6B4F" />
      </mesh>
      <mesh position={[4.2, 7.7, -2.4]} castShadow>
        <coneGeometry args={[0.5, 1.1, 12]} />
        <meshStandardMaterial color="#3E7C5E" />
      </mesh>
      {[-1.8, 0, 1.8].map((x) => (
        <Box key={x} p={[x, 1.1, 3.02]} s={[1, 2.1, 0.06]} c="#5A4632" shadow={false} />
      ))}
    </group>
  );
}

function GerejaProtestan() {
  return (
    <group>
      <Box p={[0, 1.7, 0]} s={[5, 3.4, 8]} c="#F3F0E8" />
      <Gable p={[0, 3.4, 0]} w={5.8} h={2.2} d={8.4} c="#8A4B3A" />
      <Box p={[0, 1.1, 4.03]} s={[1.2, 2.2, 0.06]} c="#5A4632" shadow={false} />
      {[-2, 0, 2].map((z) => (
        <Box key={z} p={[2.53, 2, z]} s={[0.06, 1.4, 0.6]} c="#4F6A8A" shadow={false} />
      ))}
      <Cross p={[0, 6.2, 4]} />
    </group>
  );
}

function GerejaKatolik() {
  return (
    <group>
      <Box p={[0, 1.8, -0.6]} s={[5, 3.6, 7.6]} c="#D8D2C4" />
      <Gable p={[0, 3.6, -0.6]} w={5.8} h={2} d={8} c="#5B5F66" />
      <Box p={[0, 3.6, 3.8]} s={[2.2, 7.2, 2.2]} c="#D8D2C4" />
      <mesh position={[0, 8.2, 3.8]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.7, 2, 4]} />
        <meshStandardMaterial color="#5B5F66" />
      </mesh>
      <Box p={[0, 5.6, 4.92]} s={[0.8, 0.9, 0.05]} c="#3A3530" shadow={false} />
      <mesh position={[0, 2.6, 4.93]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 20]} />
        <meshStandardMaterial color="#6B4E8C" emissive="#3E2A5A" emissiveIntensity={0.3} />
      </mesh>
      <Box p={[0, 1.1, 4.93]} s={[1.1, 2, 0.05]} c="#5A4632" shadow={false} />
      <Cross p={[0, 9.7, 3.8]} c={GOLD} s={0.9} />
    </group>
  );
}

function Pura() {
  const tower = (x: number) => (
    <group position={[x, 0, 3.4]}>
      <Box p={[0, 0.9, 0]} s={[1.7, 1.8, 1.4]} c="#A3523A" />
      <Box p={[0, 2.2, 0]} s={[1.4, 0.8, 1.15]} c="#A3523A" />
      <Box p={[0, 3, 0]} s={[1.1, 0.8, 0.9]} c="#A3523A" />
      <Box p={[0, 3.7, 0]} s={[0.7, 0.6, 0.6]} c="#A3523A" />
    </group>
  );
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[9, 0.4, 8.4]} c="#9C9184" />
      {tower(-1.45)}
      {tower(1.45)}
      {/* meru bertingkat */}
      <group position={[0, 0.4, -1.4]}>
        <Box p={[0, 0.7, 0]} s={[2, 1.4, 2]} c="#B8AE9C" />
        {[2.8, 2.2, 1.6, 1.0].map((w, i) => (
          <group key={w}>
            <Box p={[0, 1.6 + i * 0.75, 0]} s={[w, 0.3, w]} c="#3E3A35" />
            <Box p={[0, 1.95 + i * 0.75, 0]} s={[0.5, 0.4, 0.5]} c="#6B4A34" />
          </group>
        ))}
      </group>
      <Box p={[-3, 1.1, -2.2]} s={[1.6, 1.4, 1.6]} c="#B8AE9C" />
      <Box p={[-3, 2, -2.2]} s={[2, 0.3, 2]} c="#3E3A35" />
    </group>
  );
}

function Vihara() {
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[8, 0.4, 8]} c="#EDE7DA" />
      <Box p={[0, 0.6, 0]} s={[6.4, 0.4, 6.4]} c="#EDE7DA" />
      <Box p={[0, 1, 0]} s={[4.8, 0.4, 4.8]} c="#EDE7DA" />
      <mesh position={[0, 2.4, 0]} scale={[1, 0.85, 1]} castShadow>
        <sphereGeometry args={[1.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
        <meshStandardMaterial color="#D4A93A" roughness={0.45} metalness={0.2} />
      </mesh>
      <Box p={[0, 3.9, 0]} s={[0.8, 0.5, 0.8]} c="#D4A93A" />
      <mesh position={[0, 5.2, 0]} castShadow>
        <coneGeometry args={[0.45, 2.4, 12]} />
        <meshStandardMaterial color="#D4A93A" roughness={0.45} metalness={0.2} />
      </mesh>
    </group>
  );
}

function Klenteng() {
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[8, 0.3, 6.4]} c="#9C9184" />
      <Box p={[0, 1.7, -0.3]} s={[7, 2.8, 5]} c="#A8322A" />
      {[-2.6, -0.9, 0.9, 2.6].map((x) => (
        <Box key={x} p={[x, 1.6, 2.4]} s={[0.35, 2.6, 0.35]} c="#8E241E" />
      ))}
      <Box p={[0, 3.3, 0]} s={[8, 0.45, 6.4]} c="#2F5D50" />
      <Box p={[0, 3.75, 0]} s={[5.4, 0.45, 4]} c="#2F5D50" />
      <Box p={[0, 4.1, 0]} s={[6, 0.25, 0.3]} c={GOLD} />
      {[
        [-4, -3.2],
        [4, -3.2],
        [-4, 3.2],
        [4, 3.2]
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 3.55, z]} s={[0.5, 0.18, 0.5]} c="#2F5D50" rotation={[0, 0, x < 0 ? -0.5 : 0.5]} />
      ))}
      <Box p={[0, 1.2, 2.23]} s={[1.6, 2, 0.06]} c="#5A2A1E" shadow={false} />
      {[-1.7, 1.7].map((x) => (
        <group key={x} position={[x, 2.5, 2.7]}>
          <mesh>
            <sphereGeometry args={[0.32, 12, 10]} />
            <meshStandardMaterial color="#D63A2F" emissive="#B02018" emissiveIntensity={0.35} />
          </mesh>
          <Box p={[0, 0.34, 0]} s={[0.25, 0.08, 0.25]} c={GOLD} shadow={false} />
        </group>
      ))}
    </group>
  );
}

function Pew({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <Box p={[0, 0.42, 0]} s={[2.8, 0.08, 0.45]} c={MAT.woodDark} />
      <Box p={[0, 0.7, 0.25]} s={[2.8, 0.5, 0.07]} c={MAT.woodDark} />
      {[-1.25, 1.25].map((x) => (
        <Box key={x} p={[x, 0.2, 0]} s={[0.08, 0.4, 0.4]} c={MAT.woodDark} />
      ))}
    </group>
  );
}

// Perlengkapan ibadah di depan bangunan; posisinya sama dengan WORSHIP_SPOTS.
function WorshipFurniture({ id }: { id: (typeof WORSHIP)[number]["id"] }) {
  switch (id) {
    case "masjid":
      return (
        <group position={[0, 0.02, 5.25]}>
          <Box p={[0, 0, 0]} s={[5.4, 0.04, 2.9]} c="#3E7C5E" shadow={false} />
          {[-0.65, 0.65].map((z) => (
            <Box key={z} p={[0, 0.025, z]} s={[5.4, 0.01, 0.06]} c="#C9B27A" shadow={false} />
          ))}
        </group>
      );
    case "gereja-protestan":
      return (
        <>
          <Pew z={5.3} />
          <Pew z={6.5} />
        </>
      );
    case "gereja-katolik":
      return (
        <>
          <Pew z={6.1} />
          <Pew z={7.2} />
        </>
      );
    case "klenteng":
      return (
        <group position={[0, 0, 4.6]}>
          {[-0.3, 0.3].map((x) => (
            <Box key={x} p={[x, 0.2, 0]} s={[0.1, 0.4, 0.1]} c="#5A4632" />
          ))}
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.38, 0.45, 16]} />
            <meshStandardMaterial color="#8C6A2E" metalness={0.4} roughness={0.5} />
          </mesh>
          {[-0.15, 0, 0.15].map((x) => (
            <Box key={x} p={[x, 1, 0]} s={[0.02, 0.4, 0.02]} c="#C8553D" emissive="#FF7A3A" glow={0.6} shadow={false} />
          ))}
        </group>
      );
    default:
      return null;
  }
}

// Lampu jalan: bohlam menyala sesuai atmo.lamp (malam atau hujan).
function StreetLamp({ p }: { p: V3 }) {
  const bulb = useRef<Mesh>(null);
  useFrame(() => {
    const m = bulb.current?.material as MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = atmo.lamp * 1.6;
  });
  return (
    <group position={p}>
      <Box p={[0, 1.3, 0]} s={[0.12, 2.6, 0.12]} c="#4A4E54" />
      <Box p={[0, 2.66, 0]} s={[0.5, 0.12, 0.5]} c="#4A4E54" />
      <mesh ref={bulb} position={[0, 2.52, 0]}>
        <boxGeometry args={[0.32, 0.14, 0.32]} />
        <meshStandardMaterial color="#FFF1CC" emissive="#FFC870" emissiveIntensity={0} />
      </mesh>
    </group>
  );
}

const LAMPS: V3[] = [
  ...[-36, -24, -12, 0, 12, 24, 36].map((x) => [x, 0, PROMENADE_Z - 1.3] as V3),
  ...[-28, -14, 0, 14, 28].map((x) => [x, 0, PLAZA_Z + 1.3] as V3)
];

const BUILDINGS: Record<(typeof WORSHIP)[number]["id"], () => JSX.Element> = {
  masjid: Masjid,
  "gereja-protestan": GerejaProtestan,
  "gereja-katolik": GerejaKatolik,
  pura: Pura,
  vihara: Vihara,
  klenteng: Klenteng
};

function Pool() {
  const { x, z, w, d } = POOL;
  const water = useRef<Mesh>(null);
  // kilau air pelan; ikut lebih gelap saat malam
  useFrame(({ clock }) => {
    const m = water.current?.material as MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 0.18 + Math.sin(clock.elapsedTime * 1.3) * 0.06 + atmo.lamp * 0.25;
  });
  const loungers = LEISURE.filter((l) => l.key.startsWith("kursi-kolam"));
  return (
    <group>
      <Box p={[x, 0.05, z]} s={[w + 4, 0.1, d + 4]} c="#E4DCCB" shadow={false} />
      <mesh ref={water} position={[x, 0.13, z]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color="#5FA8C9" emissive="#2C6E8E" emissiveIntensity={0.25} roughness={0.15} />
      </mesh>
      {[
        [x, z - d / 2 - 0.1, w + 0.4, 0.2],
        [x, z + d / 2 + 0.1, w + 0.4, 0.2],
        [x - w / 2 - 0.1, z, 0.2, d],
        [x + w / 2 + 0.1, z, 0.2, d]
      ].map(([px, pz, sx, sz]) => (
        <Box key={`${px}${pz}`} p={[px, 0.18, pz]} s={[sx, 0.12, sz]} c="#F4F1EA" shadow={false} />
      ))}
      <group position={[x + w / 2 - 0.6, 0, z - d / 2 + 0.2]}>
        <Box p={[-0.3, 0.6, 0]} s={[0.06, 1, 0.06]} c="#B9BEC2" />
        <Box p={[0.3, 0.6, 0]} s={[0.06, 1, 0.06]} c="#B9BEC2" />
      </group>
      {/* kursi berjemur: kaki di at, kepala ke belakang */}
      {loungers.map((l) => (
        <group key={l.key} position={[l.at[0], 0, l.at[1] - 0.75]}>
          <Box p={[0, 0.3, 0]} s={[0.7, 0.12, 1.8]} c="#F2EEE4" />
          <Box p={[0, 0.5, -0.75]} s={[0.7, 0.4, 0.12]} c="#F2EEE4" rotation={[-0.5, 0, 0]} />
          <Box p={[0, 0.12, 0]} s={[0.6, 0.24, 1.6]} c="#9A8F7C" />
        </group>
      ))}
      <group position={[x - w / 2 - 1.2, 0, z - d / 2 - 1.3]}>
        <Box p={[0, 1.1, 0]} s={[0.08, 2.2, 0.08]} c="#8A8A85" />
        <mesh position={[0, 2.2, 0]} castShadow>
          <coneGeometry args={[1.3, 0.6, 8]} />
          <meshStandardMaterial color="#C8553D" />
        </mesh>
      </group>
      <Sign p={[x, 1.2, z - d / 2 - 1.8]} text="Kolam Renang" />
    </group>
  );
}

// Taman baca: pergola beratap kisi agar pembaca tetap terlihat dari atas.
function Library() {
  const { x, z, w, d } = LIBRARY;
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.06, 0]} s={[w, 0.12, d]} c="#C49A6C" shadow={false} />
      {[
        [-w / 2 + 0.2, -d / 2 + 0.2],
        [w / 2 - 0.2, -d / 2 + 0.2],
        [-w / 2 + 0.2, d / 2 - 0.2],
        [w / 2 - 0.2, d / 2 - 0.2]
      ].map(([px, pz]) => (
        <Box key={`${px}${pz}`} p={[px, 1.3, pz]} s={[0.25, 2.6, 0.25]} c={MAT.woodDark} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[-w / 2 + 0.6 + i * ((w - 1.2) / 8), 2.7, 0]} s={[0.18, 0.15, d + 0.4]} c={MAT.woodDark} />
      ))}
      {/* rak buku di sisi utara */}
      {[-3.5, -1.2, 1.2, 3.5].map((sx) => (
        <group key={sx} position={[sx, 0, -d / 2 + 0.6]}>
          <Box p={[0, 0.9, 0]} s={[2, 1.8, 0.5]} c={MAT.woodDark} />
          {[0.45, 0.95, 1.45].map((y) =>
            ["#7A3B1E", "#3D6B8C", "#C9A227", "#556B5E", "#A8452E", "#6B5B95"].map((c, i) => (
              <Box key={`${y}${i}`} p={[-0.8 + i * 0.32, y + 0.12, 0.26]} s={[0.22, 0.3, 0.06]} c={c} shadow={false} />
            ))
          )}
        </group>
      ))}
      {/* bangku baca */}
      {[-3, 0, 3].map((bx) => (
        <Box key={bx} p={[bx, 0.36, 0.9 + 0.1]} s={[1.1, 0.12, 0.5]} c={MAT.wood} />
      ))}
      <Box p={[0, 0.6, -0.3]} s={[7.5, 0.08, 0.8]} c={MAT.wood} />
      <Sign p={[0, 3.3, d / 2]} text="Taman Baca" />
    </group>
  );
}

function Park() {
  const { x, z } = PARK;
  const jet = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (jet.current) jet.current.scale.y = 0.85 + Math.sin(clock.elapsedTime * 3) * 0.15;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.6, 0.5, 20]} />
        <meshStandardMaterial color="#B8AE9C" />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 0.06, 20]} />
        <meshStandardMaterial color="#6FB3CF" emissive="#2C6E8E" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1.1, 10]} />
        <meshStandardMaterial color="#B8AE9C" />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.55, 0.25, 0.2, 14]} />
        <meshStandardMaterial color="#B8AE9C" />
      </mesh>
      <mesh ref={jet} position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 0.7, 8]} />
        <meshStandardMaterial color="#BFE3F2" transparent opacity={0.7} />
      </mesh>
      {/* bangku menghadap air mancur */}
      <Box p={[-3.9, 0.36, 0]} s={[0.5, 0.12, 1.4]} c={MAT.wood} />
      <Box p={[3.9, 0.36, 0]} s={[0.5, 0.12, 1.4]} c={MAT.wood} />
      <Box p={[0, 0.36, 3.9]} s={[1.4, 0.12, 0.5]} c={MAT.wood} />
      {[
        [-2.5, -2.5, "#C8553D"],
        [2.5, -2.5, "#E0A030"],
        [-2.5, 2.5, "#B05C8E"],
        [2.5, 2.5, "#E8D27A"]
      ].map(([fx, fz, c]) => (
        <Box key={`${fx}${fz}`} p={[fx as number, 0.15, fz as number]} s={[1.2, 0.3, 1.2]} c={c as string} />
      ))}
      <Sign p={[0, 2.3, -1.5]} text="Taman" />
    </group>
  );
}

const TREES: [number, number, number][] = [
  [-42, -28, 1.2], [-30, -28, 1], [-14, -29, 1.1], [0, -28, 1.3], [14, -29, 1], [28, -28, 1.2], [42, -27, 1.1],
  [-43, -8, 1.2], [-43, 6, 1], [-43, 22, 1.3], [43, -8, 1.1], [43, 6, 1.2], 
  [-33, 27, 1.1], [-10, 28, 1], [12, 28, 1.2], [33, 28, 1.1],
  [-28, -6, 0.9], [-28, 4, 1], [28, -6, 1], [28, 4, 0.9],
  [30, 14, 1], [20, 24, 1.1], [-10, 14, 0.9], [12, 14, 1], [33, 21, 0.9], [42, 30, 1]
];

export function Campus() {
  return (
    <group>
      <Box p={[0, -0.12, 0]} s={[CAMPUS_HALF_X * 2, 0.1, CAMPUS_HALF_Z * 2]} c={GRASS} shadow={false} />
      {/* jalan setapak */}
      <Box p={[0, -0.05, PROMENADE_Z]} s={[84, 0.04, 1.8]} c={PAVE} shadow={false} />
      <Box p={[0, -0.05, PLAZA_Z]} s={[84, 0.04, 1.8]} c={PAVE} shadow={false} />
      {[-RING_X, RING_X].map((x) => (
        <Box key={x} p={[x, -0.05, (PLAZA_Z + PROMENADE_Z) / 2]} s={[1.8, 0.04, PROMENADE_Z - PLAZA_Z]} c={PAVE} shadow={false} />
      ))}
      {[-17.6, 17.6].map((x) => (
        <Box key={x} p={[x, -0.05, -0.35]} s={[RING_X - 16.4, 0.04, 1.6]} c={PAVE} shadow={false} />
      ))}
      {WORSHIP.map((b) => (
        <Box key={b.id} p={[b.x, -0.05, (PLAZA_Z + WORSHIP_Z + 4.5) / 2]} s={[1.6, 0.04, Math.abs(WORSHIP_Z + 4.5 - PLAZA_Z)]} c={PAVE} shadow={false} />
      ))}
      {[POOL.x, LIBRARY.x, PARK.x].map((x) => (
        <Box key={x} p={[x, -0.05, PROMENADE_Z + 2.6]} s={[1.6, 0.04, 3.4]} c={PAVE} shadow={false} />
      ))}

      {WORSHIP.map((b) => {
        const Building = BUILDINGS[b.id];
        return (
          <group key={b.id} position={[b.x, 0, WORSHIP_Z]}>
            <Building />
            <WorshipFurniture id={b.id} />
            <Sign p={[0, 0.9, 7.6]} text={b.name} />
          </group>
        );
      })}

      <Pool />
      <Library />
      <Park />
      {/* tugu di pojok tenggara kampus, menghadap arah kamera bawaan */}
      <Monument position={[38, 0, 25]} rotation={Math.PI / 4} />
      {LAMPS.map((p) => (
        <StreetLamp key={`${p[0]}${p[2]}`} p={p} />
      ))}
      {TREES.map(([x, z, s]) => (
        <Tree key={`${x}${z}`} p={[x, 0, z]} s={s} />
      ))}
    </group>
  );
}
