import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { type Mesh, Vector3 } from "three";
import type { AgentStatus } from "../../state/reduce.ts";
import { STATUS_LABEL } from "../../panels/DivisionsPanel.tsx";
import { useDivisionName } from "../../state/store.ts";
import { useAgentStatus } from "../../state/useAgentStatus.ts";
import { FLOOR_H, ROOM_D, ROOM_W, type RoomDef, WALL_H } from "./layout.ts";
import { lookOf, MAT, type Signature as SignatureKind, tint, useLook } from "./looks.ts";
import { Box, type V3 } from "./parts.tsx";
import { BeanBag, BigPlant, glassMaterial, RoundRug } from "./props.tsx";
import { StaticBatch } from "./StaticBatch.tsx";

// Properti khas yang tidak bergantung status dan tidak bisa diklik (boleh digabung).
const STATIC_SIGNATURE = new Set<SignatureKind>(["easel", "checklist", "screens", "chart", "books", "rack", "mic", "typewriter", "poster"]);

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

// Dinding belakang yang padat. Saat menghadap kamera ia turun rendah (gaya potongan rumah boneka)
// agar isi ruangan terlihat. `accent`: panel warna di muka dalam dinding, ikut turun bersamanya.
export function Wall({ p, s, n, accent, lamp }: { p: V3; s: V3; n: [number, number]; accent?: string; lamp?: string | null }) {
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
      {/* lampu status: hanya menyala bila ada keadaan yang berarti, ikut turun bersama dinding */}
      {lamp !== undefined && (
        <Box p={[0.9, 1.45 - s[1] / 2, s[2] / 2 + 0.03]} s={[0.5, 0.07, 0.05]} c={lamp ?? MAT.wallTop} emissive={lamp ?? undefined} glow={lamp ? 1 : 0} shadow={false} />
      )}
    </Box>
  );
}

// Dinding kaca dengan bingkai putih tipis di atas dan bawah serta tiang di kedua ujung.
// Panjang panel searah sumbu x lokal; dirotasi untuk dinding samping.
export function Glass({ p, len, ry = 0 }: { p: V3; len: number; ry?: number }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh material={glassMaterial} position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[len, WALL_H - 0.1, 0.04]} />
      </mesh>
      <Box p={[0, WALL_H - 0.03, 0]} s={[len, 0.06, 0.09]} c={MAT.wall} shadow={false} />
      <Box p={[0, 0.04, 0]} s={[len, 0.08, 0.09]} c={MAT.wall} shadow={false} />
      {[-len / 2, len / 2].map((x) => (
        <Box key={x} p={[x, WALL_H / 2, 0]} s={[0.08, WALL_H, 0.09]} c={MAT.wall} shadow={false} />
      ))}
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
    case "mic":
      // studio audio: panel peredam warna-warni di dinding, mikrofon di lengan, monitor speaker
      return (
        <group>
          {[-0.45, 0, 0.45].map((x, i) =>
            [1.25, 0.8].map((y, j) => (
              <Box key={`${x}${y}`} p={[-1.1 + x, y, -HD + 0.1]} s={[0.4, 0.4, 0.08]} c={(i + j) % 2 ? accent : "#3A3440"} shadow={false} />
            ))
          )}
          <Box p={[0.45, 0.95, -0.35]} s={[0.03, 0.4, 0.03]} c={MAT.metal} shadow={false} />
          <Box p={[0.45, 1.15, -0.25]} s={[0.09, 0.16, 0.09]} c="#2A2A2A" shadow={false} />
          {[-0.65, 0.65].map((x) => (
            <Box key={x} p={[x, 0.9, -0.42]} s={[0.18, 0.28, 0.18]} c="#2E2B33" shadow={false} />
          ))}
        </group>
      );
    case "typewriter":
      // meja penulis: mesin tik, tumpukan kertas, rak buku rendah
      return (
        <group>
          <Box p={[0.45, 0.82, -0.25]} s={[0.42, 0.14, 0.32]} c={accent} />
          <Box p={[0.45, 0.93, -0.36]} s={[0.36, 0.1, 0.03]} c="#FBF7EE" shadow={false} />
          {[0, 1, 2].map((i) => (
            <Box key={i} p={[-0.5, 0.77 + i * 0.03, -0.25]} s={[0.3, 0.02, 0.4]} c="#FBF7EE" shadow={false} />
          ))}
          <group position={[-1.6, 0, -1.4]}>
            <Box p={[0, 0.45, 0]} s={[0.9, 0.9, 0.4]} c={MAT.woodDark} />
            {["#7A3B1E", "#3D6B8C", "#C9A227", "#556B5E"].map((c, i) => (
              <Box key={c} p={[-0.3 + i * 0.2, 0.65, 0.12]} s={[0.12, 0.3, 0.2]} c={c} shadow={false} />
            ))}
          </group>
        </group>
      );
    case "poster":
      // studio desain grafis: dinding poster berbingkai dan tablet gambar di meja
      return (
        <group>
          {(
            [
              [-1.45, 1.1, 0.5, 0.7, accent],
              [-0.85, 1.2, 0.45, 0.5, "#F2C14E"],
              [-0.85, 0.75, 0.45, 0.3, "#2A9D8F"]
            ] as const
          ).map(([x, y, w, h, c]) => (
            <group key={`${x}${y}`} position={[x, y, -HD + 0.1]}>
              <Box p={[0, 0, 0]} s={[w + 0.06, h + 0.06, 0.03]} c="#2A2A2A" shadow={false} />
              <Box p={[0, 0, 0.02]} s={[w, h, 0.02]} c={c} shadow={false} />
            </group>
          ))}
          <Box p={[0.5, 0.77, -0.15]} s={[0.4, 0.02, 0.28]} c="#2A2D34" shadow={false} />
          <Box p={[0.62, 0.79, -0.08]} s={[0.02, 0.02, 0.18]} c={accent} shadow={false} />
        </group>
      );
    case "phone": {
      // studio sosial media: ring light dengan ponsel, papan grid feed
      const live = status === "working";
      return (
        <group>
          <group position={[-1.1, 0, -HD + 0.1]}>
            <Box p={[0, 1.05, 0]} s={[1.2, 1.2, 0.05]} c="#FAFAF7" />
            {[-0.36, 0, 0.36].map((x, i) =>
              [0.36, 0, -0.36].map((y, j) => (
                <Box key={`${x}${y}`} p={[x, 1.05 + y, 0.04]} s={[0.3, 0.3, 0.02]} c={["#F2C14E", accent, "#E07A5F", "#8E7DBE"][(i + j * 3) % 4]} shadow={false} />
              ))
            )}
          </group>
          <group position={[1.35, 0, -0.9]}>
            <Box p={[0, 0.6, 0]} s={[0.04, 1.2, 0.04]} c={MAT.metal} shadow={false} />
            <mesh position={[0, 1.3, 0]} rotation={[0, 0.6, 0]} castShadow>
              <torusGeometry args={[0.24, 0.04, 8, 24]} />
              <meshStandardMaterial color="#FFF4E0" emissive="#FFE7C2" emissiveIntensity={live ? 1.1 : 0.15} />
            </mesh>
            <Box p={[0, 1.3, 0]} s={[0.1, 0.18, 0.02]} c="#1E1E22" rotation={[0, 0.6, 0]} shadow={false} />
          </group>
        </group>
      );
    }
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
  signs: boolean; // papan nama hanya di lantai yang sedang dilihat
}

export function Room({ room, selected, onSelect, onBoard, tone, signs }: RoomProps) {
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
    <group position={[room.x, room.level * FLOOR_H, room.z]} scale={[room.w / ROOM_W, 1, 1]}>
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
        <Wall p={[0, WALL_H / 2, -HD]} s={[ROOM_W + T, WALL_H, T]} n={[0, -flip]} accent={tone} lamp={lamp} />


        {/* meja, kursi, tanaman, dan properti yang tidak berubah: digabung jadi beberapa draw call */}
        <StaticBatch>
          {/* dinding kaca: dua sisi dan bagian depan di kiri-kanan pintu */}
          <Glass p={[-HW, 0, 0]} len={ROOM_D} ry={Math.PI / 2} />
          <Glass p={[HW, 0, 0]} len={ROOM_D} ry={Math.PI / 2} />
          {[-1, 1].map((side) => (
            <Glass key={side} p={[side * (DOOR / 2 + (HW - DOOR / 2) / 2), 0, HD]} len={HW - DOOR / 2} />
          ))}
          <RoundRug p={[0, 0.05, -0.4]} r={1.15} c={tint(tone, 0.45)} />
          <Box p={[0, 0.72, -0.2]} s={[1.5, 0.06, 0.7]} c={MAT.wall} />
          {[
            [-0.68, -0.48],
            [0.68, -0.48],
            [-0.68, 0.08],
            [0.68, 0.08]
          ].map(([x, z]) => (
            <Box key={`${x}${z}`} p={[x, 0.35, z]} s={[0.06, 0.7, 0.06]} c={MAT.wood} />
          ))}
          <Box p={[0, 0.2, -0.95]} s={[0.06, 0.4, 0.06]} c={MAT.metal} />
          <Box p={[0, 0.42, -0.95]} s={[0.5, 0.07, 0.5]} c={tone} />
          <Box p={[0, 0.72, -1.2]} s={[0.5, 0.55, 0.07]} c={tone} />
          <BeanBag p={[-HW + 0.55, 0, HD - 0.6]} c={tone} />
          <BigPlant p={[HW - 0.45, 0, -HD + 0.45]} s={0.75} />
          {fixed && <Signature id={room.id} status={status} onBoard={handleBoard} />}
        </StaticBatch>
        <Monitor p={[0, 0.75, 0.0]} status={status} />
        {/* properti yang berubah sesuai status atau bisa diklik tetap terpisah */}
        {!fixed && <Signature id={room.id} status={status} onBoard={handleBoard} />}

        {(signs || selected) && (
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
        )}
      </group>
    </group>
  );
}
