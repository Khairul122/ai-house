import { Html } from "@react-three/drei";
import { useState } from "react";
import type { Floor } from "../../state/store.ts";
import {
  CORRIDOR_HALF,
  FLOOR_H,
  FLOOR_HALF_X,
  FLOOR_HALF_Z,
  LIFT,
  ROOM_D,
  type RoomDef,
  WALL_H,
} from "./layout.ts";
import { MAT, TONES, tint, toneAt } from "./looks.ts";
import { Box } from "./parts.tsx";
import { BigPlant, glassMaterial } from "./props.tsx";
import { Glass, Wall } from "./Room.tsx";
import { StaticBatch } from "./StaticBatch.tsx";

const SLAB = 0.12;
const PILLAR_X = [-16.3, -8.1, 0, 8.1, 16.3];

// Pelat lantai atas, kolom, dan koridornya. Lantai dasar digambar di OfficeCanvas (Commons)
// karena berisi resepsionis dan pantry.
export function UpperFloor({ level }: { level: number }) {
  const y = level * FLOOR_H;
  return (
    <StaticBatch>
      <Box
        p={[0, y - SLAB / 2, 0]}
        s={[FLOOR_HALF_X * 2 + 0.4, SLAB, FLOOR_HALF_Z * 2 + 0.4]}
        c={MAT.concrete}
      />
      {/* pita warna lantai di tepi pelat: penanda bidang dari luar gedung */}
      <Box
        p={[0, y - SLAB - 0.03, 0]}
        s={[FLOOR_HALF_X * 2 + 0.5, 0.06, FLOOR_HALF_Z * 2 + 0.5]}
        c={toneAt(level)}
        shadow={false}
        round={false}
      />
      <Box
        p={[0, y + 0.005, 0]}
        s={[FLOOR_HALF_X * 2 - 1, 0.02, CORRIDOR_HALF * 2]}
        c={MAT.corridor}
        shadow={false}
        round={false}
      />
      <Box
        p={[0, y + 0.02, 0]}
        s={[FLOOR_HALF_X * 2 - 6, 0.012, 0.9]}
        c={tint(toneAt(level), 0.55)}
        shadow={false}
        round={false}
      />
      {PILLAR_X.flatMap((x) =>
        [-1, 1].map((sz) => (
          <Box
            key={`${x}${sz}`}
            p={[x, y - FLOOR_H / 2, sz * (FLOOR_HALF_Z + 0.05)]}
            s={[0.3, FLOOR_H - SLAB, 0.3]}
            c={MAT.wall}
          />
        )),
      )}
      {/* pagar kaca di kedua ujung koridor */}
      {[-1, 1].map((sx) => (
        <mesh
          key={sx}
          material={glassMaterial}
          position={[sx * (FLOOR_HALF_X + 0.1), y + 0.5, 0]}
        >
          <boxGeometry args={[0.05, 1, CORRIDOR_HALF * 2 + 0.6]} />
        </mesh>
      ))}
      {[
        [-1, 1],
        [1, 1],
        [1, -1],
      ].map(([sx, sz]) => (
        <BigPlant
          key={`${sx}${sz}`}
          p={[sx * (FLOOR_HALF_X - 0.5), y, sz * (FLOOR_HALF_Z - 0.5)]}
          s={0.8}
        />
      ))}
      {/* sudut santai di ujung timur: bangku dan meja kopi kecil */}
      <group position={[15.2, y, 1.8]}>
        <Box
          p={[0, 0.22, 0]}
          s={[0.6, 0.44, 1.8]}
          c={TONES[(level + 2) % TONES.length]}
        />
        <Box
          p={[0.22, 0.55, 0]}
          s={[0.16, 0.4, 1.8]}
          c={tint(TONES[(level + 2) % TONES.length], 0.15)}
        />
        <Box p={[-0.8, 0.2, 0]} s={[0.5, 0.06, 0.5]} c={MAT.wood} />
      </group>
    </StaticBatch>
  );
}

// Poros lift kaca dari lantai dasar sampai lantai teratas yang terlihat, dengan pintu dan papan nama tiap lantai.
export function LiftCore({
  floors,
  top,
  only,
}: { floors: Floor[]; top: number; only: number | null }) {
  const height = (top + 1) * FLOOR_H - 0.6;
  const [x, z] = LIFT.cab;
  return (
    <group position={[x, 0, z]}>
      <StaticBatch>
        {[
          [-0.8, -0.8],
          [0.8, -0.8],
          [-0.8, 0.8],
          [0.8, 0.8],
        ].map(([px, pz]) => (
          <Box
            key={`${px}${pz}`}
            p={[px, height / 2, pz]}
            s={[0.12, height, 0.12]}
            c={MAT.metal}
          />
        ))}
        <Box p={[0, height / 2, -0.78]} s={[1.5, height, 0.06]} c={MAT.wall} />
        <Box p={[0, height + 0.15, 0]} s={[1.8, 0.3, 1.8]} c={MAT.wall} />
        {floors.slice(0, top + 1).map((f) => (
          <group key={f.id} position={[0, f.level * FLOOR_H, 0.8]}>
            <Box
              p={[0, WALL_H + 0.25, 0]}
              s={[1.6, 0.12, 0.1]}
              c={MAT.wall}
              shadow={false}
            />
            {[-0.38, 0.38].map((dx) => (
              <Box
                key={dx}
                p={[dx, WALL_H / 2 + 0.1, 0.02]}
                s={[0.72, WALL_H + 0.2, 0.04]}
                c={toneAt(f.level)}
                shadow={false}
              />
            ))}
          </group>
        ))}
      </StaticBatch>
      <mesh material={glassMaterial} position={[-0.8, height / 2, 0]}>
        <boxGeometry args={[0.04, height, 1.5]} />
      </mesh>
      <mesh material={glassMaterial} position={[0.8, height / 2, 0]}>
        <boxGeometry args={[0.04, height, 1.5]} />
      </mesh>
      {floors
        .slice(0, top + 1)
        .filter((f) => only === null || f.level === only)
        .map((f) => (
          <Html
            key={f.id}
            position={[0, f.level * FLOOR_H + WALL_H + 0.75, 0.9]}
            center
            zIndexRange={[10, 0]}
            pointerEvents="none"
          >
            <div
              className="room-sign floor-sign"
              style={{ borderColor: toneAt(f.level) }}
            >
              Lt {f.level + 1} · {f.name}
            </div>
          </Html>
        ))}
    </group>
  );
}

interface MeetingProps {
  room: RoomDef;
  signs: boolean;
  floorName: string;
  active: boolean; // rapat sedang berlangsung
  onOpen: () => void;
}

// Ruang rapat lantai: meja panjang dengan delapan kursi, layar presentasi, dan papan tulis.
// Layar menyala dan papan nama berdenyut saat rapat berlangsung; klik membuka panel lantai.
export function MeetingRoom({
  room,
  floorName,
  active,
  onOpen,
  signs,
}: MeetingProps) {
  const [hover, setHover] = useState(false);
  const hw = room.w / 2;
  const hd = ROOM_D / 2;
  const tone = toneAt(room.level + 3);
  const door = 1.3;
  return (
    <group position={[room.x, room.level * FLOOR_H, room.z]}>
      <mesh
        visible={false}
        position={[0, 0.15, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
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
        <boxGeometry args={[room.w, 0.3, ROOM_D]} />
      </mesh>
      <Box
        p={[0, 0.02, 0]}
        s={[room.w, 0.04, ROOM_D]}
        c={tint(tone, 0.6)}
        emissive={tone}
        glow={hover ? 0.12 : 0}
        shadow={false}
      />
      <Wall
        p={[0, WALL_H / 2, -hd]}
        s={[room.w + 0.12, WALL_H, 0.12]}
        n={[0, -1]}
        accent={tone}
      />
      <StaticBatch>
        <Glass p={[-hw, 0, 0]} len={ROOM_D} ry={Math.PI / 2} />
        <Glass p={[hw, 0, 0]} len={ROOM_D} ry={Math.PI / 2} />
        {[-1, 1].map((side) => (
          <Glass
            key={side}
            p={[side * (door / 2 + (hw - door / 2) / 2), 0, hd]}
            len={hw - door / 2}
          />
        ))}
        {/* meja panjang dan kaki */}
        <Box p={[0, 0.72, 0]} s={[3.8, 0.07, 1.0]} c={MAT.wood} />
        {[-1.6, 1.6].map((x) => (
          <Box key={x} p={[x, 0.36, 0]} s={[0.1, 0.7, 0.7]} c={MAT.woodDark} />
        ))}
        {/* delapan kursi, posisinya sama dengan meetingSeats() */}
        {[-1.5, -0.5, 0.5, 1.5].flatMap((x) =>
          [-1, 1].map((sz) => (
            <group key={`${x}${sz}`} position={[x, 0, sz * 0.95]}>
              <Box
                p={[0, 0.2, 0]}
                s={[0.06, 0.4, 0.06]}
                c={MAT.metal}
                shadow={false}
              />
              <Box p={[0, 0.42, 0]} s={[0.46, 0.07, 0.46]} c={tone} />
              <Box p={[0, 0.7, sz * 0.22]} s={[0.46, 0.5, 0.07]} c={tone} />
            </group>
          )),
        )}
        {/* papan tulis di dinding samping */}
        <Box p={[hw - 0.12, 1.05, -0.2]} s={[0.05, 0.8, 1.4]} c="#FAFAF7" />
        <Box
          p={[hw - 0.15, 1.15, -0.5]}
          s={[0.02, 0.05, 0.6]}
          c="#3D6B8C"
          shadow={false}
        />
        <Box
          p={[hw - 0.15, 0.95, -0.1]}
          s={[0.02, 0.05, 0.8]}
          c="#E07A5F"
          shadow={false}
        />
        <BigPlant p={[-hw + 0.45, 0, hd - 0.5]} s={0.7} />
      </StaticBatch>
      {/* layar presentasi: menyala saat rapat */}
      <Box
        p={[0, 1.15, -hd + 0.14]}
        s={[1.9, 0.95, 0.05]}
        c={active ? "#DCE8F7" : MAT.screenOff}
        emissive={active ? "#9DBEF2" : undefined}
        glow={active ? 0.9 : 0}
      />
      {(signs || active) && (
        <Html
          position={[0, WALL_H + 0.25, hd]}
          center
          zIndexRange={[10, 0]}
          pointerEvents="none"
        >
          <div
            className={`room-sign meeting-sign${active ? " is-live" : ""}`}
            style={{ borderColor: tone }}
          >
            {active ? "Rapat berlangsung" : "Ruang Rapat"}
          </div>
          {hover && (
            <div className="room-peek">
              <strong>Ruang Rapat {floorName}</strong>
              <span className="room-peek-hint">
                Klik untuk mengadakan rapat atau melihat notulen
              </span>
            </div>
          )}
        </Html>
      )}
    </group>
  );
}
