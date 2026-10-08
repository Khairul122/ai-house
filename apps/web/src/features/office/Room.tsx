import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { type Mesh, Vector3 } from "three";
import type { AgentStatus } from "../../state/reduce.ts";
import { STATUS_LABEL } from "../../panels/DivisionsPanel.tsx";
import { useDivisionName } from "../../state/store.ts";
import { useAgentStatus } from "../../state/useAgentStatus.ts";
import { ROOM_D, ROOM_W, type RoomDef, WALL_H } from "./layout.ts";
import { lookOf, MAT, type Signature as SignatureKind, useLook } from "./looks.ts";
import { Box, type V3 } from "./parts.tsx";
import { StaticBatch } from "./StaticBatch.tsx";

// Properti khas yang tidak bergantung status dan tidak bisa diklik (boleh digabung).
const STATIC_SIGNATURE = new Set<SignatureKind>(["easel", "checklist", "screens", "chart", "books", "rack"]);

const HW = ROOM_W / 2;
const HD = ROOM_D / 2;
const T = 0.12;
const DOOR = 1.3;

const SCREEN: Record<AgentStatus, [string, number]> = {
  idle: [MAT.screenOff, 0],
  working: [MAT.working, 0.9],
  waiting: [MAT.waiting, 0.7],
  failed: [MAT.failed, 0.8],
  done: [MAT.done, 0.7]
};

// Warna aksen dicampur putih, untuk karpet yang tidak terlalu mencolok.
function tint(hex: string, white: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * white);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}

// Dinding yang menghadap kamera turun rendah (gaya potongan rumah boneka) agar isi ruangan terlihat.
// `accent`: panel warna di muka dalam dinding, ikut turun bersama dindingnya.
function Wall({ p, s, n, accent }: { p: V3; s: V3; n: [number, number]; accent?: string }) {
  const ref = useRef<Mesh>(null);
  const dir = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    camera.getWorldDirection(dir);
    const facing = n[0] * dir.x + n[1] * dir.z < -0.15;
    m.scale.y += ((facing ? 0.12 : 1) - m.scale.y) * 0.15;
    m.position.y = (s[1] * m.scale.y) / 2;
  });
  return (
    <Box ref={ref} p={p} s={s} c={MAT.wall}>
      {accent && <Box p={[0, s[1] * 0.06, s[2] / 2 + 0.006]} s={[s[0] * 0.9, s[1] * 0.7, 0.012]} c={accent} shadow={false} />}
    </Box>
  );
}

// Bean bag bulat di pojok ruangan.
function BeanBag({ p, c }: { p: V3; c: string }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.62, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.36, 14, 10]} />
        <meshStandardMaterial color={c} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.36, -0.12]} scale={[0.9, 0.55, 0.6]}>
        <sphereGeometry args={[0.3, 12, 8]} />
        <meshStandardMaterial color={c} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Plant({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Box p={[0, 0.15, 0]} s={[0.3, 0.3, 0.3]} c={MAT.pot} />
      <Box p={[0, 0.5, 0]} s={[0.42, 0.42, 0.42]} c={MAT.plant} />
      <Box p={[0.05, 0.82, -0.03]} s={[0.24, 0.24, 0.24]} c="#6E9156" />
    </group>
  );
}

function Monitor({ p, status, ry = 0 }: { p: V3; status: AgentStatus; ry?: number }) {
  const [color, glow] = SCREEN[status];
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <Box p={[0, 0.33, 0]} s={[0.7, 0.42, 0.04]} c={color} emissive={color} glow={glow} />
      <Box p={[0, 0.06, 0.02]} s={[0.08, 0.14, 0.06]} c={MAT.metal} />
    </group>
  );
}

// Properti khas ruangan sesuai `persona.signature` divisi, dalam koordinat lokal ruangan (koridor di +z).
// Papan tugas ("board") bisa diklik untuk membuka daftar proyek.
function Signature({ id, status, onBoard }: { id: string; status: AgentStatus; onBoard: (e: ThreeEvent<MouseEvent>) => void }) {
  const { accent, signature } = lookOf(id);
  switch (signature) {
    case "board":
      return (
        <group position={[-1.1, 0, -HD + 0.1]} onClick={onBoard}>
          <Box p={[0, 1.05, 0]} s={[1.5, 0.9, 0.05]} c="#F4EEDF" />
          {[-0.45, 0, 0.45].map((x, col) =>
            [0.25, 0.05, -0.15].slice(0, 3 - col).map((y, i) => (
              <Box key={`${col}-${i}`} p={[x, 1.05 + y, 0.04]} s={[0.3, 0.14, 0.02]} c={["#E9C46A", "#E7A07A", "#9CC5A1"][col]} shadow={false} />
            ))
          )}
        </group>
      );
    case "monitor":
      return <Monitor p={[0.62, 0.75, -0.02]} status={status} ry={-0.45} />;
    case "easel":
      return (
        <group position={[-1.45, 0, -1.0]} rotation={[0, 0.5, 0]}>
          <Box p={[-0.25, 0.6, 0]} s={[0.05, 1.2, 0.05]} c={MAT.woodDark} />
          <Box p={[0.25, 0.6, 0]} s={[0.05, 1.2, 0.05]} c={MAT.woodDark} />
          <Box p={[0, 1.05, 0.04]} s={[0.75, 0.6, 0.03]} c="#FBF7EE" />
          <Box p={[-0.15, 1.12, 0.06]} s={[0.25, 0.2, 0.01]} c={accent} shadow={false} />
          <Box p={[0.15, 0.95, 0.06]} s={[0.22, 0.12, 0.01]} c="#3D6B8C" shadow={false} />
        </group>
      );
    case "server": {
      const led = status === "failed" ? MAT.failed : status === "idle" ? "#3B6B4A" : MAT.done;
      return (
        <group position={[-1.6, 0, -1.4]}>
          <Box p={[0, 0.7, 0]} s={[0.6, 1.4, 0.6]} c={MAT.metal} />
          {[0.35, 0.6, 0.85, 1.1].map((y) => (
            <Box key={y} p={[0.12, y, 0.31]} s={[0.18, 0.04, 0.02]} c={led} emissive={led} glow={0.8} shadow={false} />
          ))}
        </group>
      );
    }
    case "checklist":
      return (
        <group position={[-1.1, 0, -HD + 0.1]}>
          <Box p={[0, 1.05, 0]} s={[1.4, 0.85, 0.05]} c="#FAFAF7" />
          {[0.22, 0, -0.22].map((y, i) => (
            <group key={y}>
              <Box p={[-0.45, 1.05 + y, 0.04]} s={[0.1, 0.1, 0.02]} c={i < 2 ? MAT.done : "#BBB"} shadow={false} />
              <Box p={[0.05, 1.05 + y, 0.04]} s={[0.75, 0.04, 0.02]} c="#9A9A94" shadow={false} />
            </group>
          ))}
        </group>
      );
    case "screens":
      return (
        <group position={[-1.1, 0, -HD + 0.1]}>
          {[
            [-0.33, 1.25],
            [0.33, 1.25],
            [-0.33, 0.85],
            [0.33, 0.85]
          ].map(([x, y]) => (
            <Box key={`${x}${y}`} p={[x, y, 0]} s={[0.6, 0.36, 0.05]} c="#1E2A38" emissive="#3A5A7A" glow={0.5} />
          ))}
        </group>
      );
    case "chart":
      return (
        <group position={[-1.1, 0, -HD + 0.1]}>
          <Box p={[0, 1.05, 0]} s={[1.3, 0.85, 0.05]} c="#F4EEDF" />
          {[0.18, 0.4, 0.28, 0.55].map((h, i) => (
            <Box key={i} p={[-0.42 + i * 0.28, 0.72 + h / 2, 0.04]} s={[0.16, h, 0.02]} c={accent} shadow={false} />
          ))}
        </group>
      );
    case "camera":
      return (
        <group position={[-1.4, 0, -0.5]}>
          <Box p={[0, 0.55, 0]} s={[0.05, 1.1, 0.05]} c={MAT.metal} />
          <Box p={[0, 1.15, 0]} s={[0.3, 0.2, 0.25]} c="#2A2A2A" />
          <mesh position={[0.3, 1.25, -0.9]} castShadow>
            <torusGeometry args={[0.26, 0.045, 8, 24]} />
            <meshStandardMaterial color="#FFF4E0" emissive="#FFE7C2" emissiveIntensity={status === "working" ? 1 : 0.2} />
          </mesh>
          <Box p={[0.3, 0.6, -0.9]} s={[0.04, 1.2, 0.04]} c={MAT.metal} />
        </group>
      );
    case "books":
      return (
        <group position={[-1.8, 0, -1.0]}>
          <Box p={[0, 0.75, 0]} s={[0.4, 1.5, 1.2]} c={MAT.woodDark} />
          {[0.35, 0.75, 1.15].map((y) =>
            ["#7A3B1E", "#3D6B8C", "#C9A227", "#556B5E", "#A8452E"].map((c, i) => (
              <Box key={`${y}${i}`} p={[0.18, y + 0.12, -0.45 + i * 0.22]} s={[0.06, 0.26, 0.16]} c={c} shadow={false} />
            ))
          )}
        </group>
      );
    case "rack":
      return (
        <group position={[-1.6, 0, -1.5]}>
          <Box p={[0, 0.5, 0]} s={[0.55, 1.0, 0.45]} c={MAT.metal} />
          {[0.3, 0.55, 0.8].map((y) => (
            <Box key={y} p={[0, y, 0.24]} s={[0.45, 0.06, 0.02]} c="#2C2F33" shadow={false} />
          ))}
          <Box p={[0.6, 0.03, 0.15]} s={[0.9, 0.04, 0.05]} c="#D49A1F" shadow={false} />
          <Box p={[0.5, 0.03, 0.3]} s={[0.7, 0.04, 0.05]} c="#3D6B8C" shadow={false} />
        </group>
      );
    default:
      return null;
  }
}

interface RoomProps {
  room: RoomDef;
  selected: boolean;
  onSelect: (id: string) => void;
  onBoard: () => void;
  tone: string; // warna aksen ruangan dari palet kampus
}

export function Room({ room, selected, onSelect, onBoard, tone }: RoomProps) {
  const { status, agent } = useAgentStatus(room.id);
  const nameOf = useDivisionName();
  const [hover, setHover] = useState(false);
  const look = useLook(room.id);
  const fixed = STATIC_SIGNATURE.has(look.signature);
  const flip = room.side === "s" ? -1 : 1; // normal dinding dalam koordinat dunia
  const lamp = status === "idle" ? null : SCREEN[status][0];

  const handleBoard = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onBoard();
  };

  return (
    <group position={[room.x, 0, room.z]} scale={[room.w / ROOM_W, 1, 1]}>
      {/* Area klik: satu kotak tak terlihat seluas lantai, bukan ratusan mesh ruangan. */}
      <mesh
        visible={false}
        position={[0, 0.15, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(room.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[ROOM_W, 0.3, ROOM_D]} />
      </mesh>
      <group rotation={[0, room.side === "s" ? Math.PI : 0, 0]}>
        <Box
          p={[0, 0.02, 0]}
          s={[ROOM_W, 0.04, ROOM_D]}
          c={MAT.wood}
          emissive={look.accent}
          glow={selected ? 0.22 : hover ? 0.12 : 0}
          shadow={false}
        />
        <Wall p={[0, WALL_H / 2, -HD]} s={[ROOM_W + T, WALL_H, T]} n={[0, -flip]} accent={tone} />
        <Wall p={[-HW, WALL_H / 2, 0]} s={[T, WALL_H, ROOM_D]} n={[-flip, 0]} />
        <Wall p={[HW, WALL_H / 2, 0]} s={[T, WALL_H, ROOM_D]} n={[flip, 0]} />
        {[-1, 1].map((side) => (
          <Wall
            key={side}
            p={[side * (DOOR / 2 + (HW - DOOR / 2) / 2), WALL_H / 2, HD]}
            s={[HW - DOOR / 2 + T / 2, WALL_H, T]}
            n={[0, flip]}
          />
        ))}

        {/* lampu status di dinding belakang: hanya menyala bila ada keadaan yang berarti */}
        <Box p={[0.9, 1.45, -HD + 0.09]} s={[0.5, 0.07, 0.05]} c={lamp ?? MAT.wallTop} emissive={lamp ?? undefined} glow={lamp ? 1 : 0} shadow={false} />

        {/* meja, kursi, tanaman, dan properti yang tidak berubah: digabung jadi beberapa draw call */}
        <StaticBatch>
          <Box p={[0, 0.72, -0.2]} s={[1.5, 0.06, 0.7]} c={MAT.wood} />
          {[
            [-0.68, -0.48],
            [0.68, -0.48],
            [-0.68, 0.08],
            [0.68, 0.08]
          ].map(([x, z]) => (
            <Box key={`${x}${z}`} p={[x, 0.35, z]} s={[0.06, 0.7, 0.06]} c={MAT.woodDark} />
          ))}
          <Box p={[0, 0.2, -0.95]} s={[0.06, 0.4, 0.06]} c={MAT.metal} />
          <Box p={[0, 0.42, -0.95]} s={[0.5, 0.07, 0.5]} c={tone} />
          <Box p={[0, 0.72, -1.2]} s={[0.5, 0.55, 0.07]} c={tone} />
          <Box p={[0, 0.05, -0.45]} s={[2.4, 0.02, 1.9]} c={tint(tone, 0.72)} shadow={false} />
          <BeanBag p={[-HW + 0.55, 0, HD - 0.6]} c={tone} />
          <Plant p={[HW - 0.35, 0, -HD + 0.35]} />
          {fixed && <Signature id={room.id} status={status} onBoard={handleBoard} />}
        </StaticBatch>
        <Monitor p={[0, 0.75, 0.0]} status={status} />
        {/* properti yang berubah sesuai status atau bisa diklik tetap terpisah */}
        {!fixed && <Signature id={room.id} status={status} onBoard={handleBoard} />}

        <Html position={[0, WALL_H + 0.25, HD]} center zIndexRange={[10, 0]} pointerEvents="none">
          <div className={`room-sign${selected ? " is-selected" : ""}`} style={{ borderColor: tone }}>
            {look.short}
          </div>
          {/* kartu singkat saat kursor di atas ruangan: nama divisi, status, dan tugasnya */}
          {hover && !selected && (
            <div className="room-peek">
              <strong>{nameOf(room.id)}</strong>
              <span className={`tag tag-${status}`}>{STATUS_LABEL[status]}</span>
              {agent?.task && status !== "idle" && <span className="room-peek-task">{agent.task.title}</span>}
              <span className="room-peek-hint">Klik untuk mendekat</span>
            </div>
          )}
        </Html>
      </group>
    </group>
  );
}
