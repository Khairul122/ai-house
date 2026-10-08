import { CameraControls, Html } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Campus } from "./Campus.tsx";
import { Character } from "./Character.tsx";
import { CORRIDOR_HALF, FLOOR_HALF_X, FLOOR_HALF_Z, ROOMS, roomById } from "./layout.ts";
import { MAT } from "./looks.ts";
import { Box } from "./parts.tsx";
import { Room } from "./Room.tsx";

export interface OfficeProps {
  selectedId: string | null;
  panelOpen: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onOpenProjects: () => void;
}

const PANEL_W = 420; // lebar panel samping di laptop, harus sama dengan CSS

function CameraRig({ selectedId, panelOpen, reducedMotion }: Pick<OfficeProps, "selectedId" | "panelOpen" | "reducedMotion">) {
  const ref = useRef<CameraControls>(null);
  const { size } = useThree();
  const portrait = size.height > size.width;
  // Di layar tegak, koridor diputar memanjang dari atas ke bawah agar gedung tidak mengecil.
  const officeFit = portrait ? Math.min(size.width / 17, size.height / 38) : Math.min(size.width / 33, size.height / 21);
  // Tampilan awal: gedung beserta kampus di sekitarnya; bisa di-zoom keluar sampai seluruh kampus terlihat.
  const fit = portrait ? Math.min(size.width / 30, size.height / 62) : Math.min(size.width / 60, size.height / 38);
  const wide = size.width >= 768;

  useEffect(() => {
    void ref.current?.rotateTo(portrait ? 1.25 : Math.PI / 4, 0.9, false);
  }, [portrait]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const anim = !reducedMotion;
    const room = selectedId ? roomById(selectedId) : null;
    const zoom = room ? Math.max(officeFit * 2.4, 55) : fit;
    if (room) void c.moveTo(room.x, 0.6, room.z, anim);
    else void c.moveTo(0, 0, 0, anim);
    void c.zoomTo(zoom, anim);
    // geser fokus supaya ruangan tidak tertutup panel
    const ox = panelOpen && wide ? PANEL_W / 2 / zoom : 0;
    const oy = panelOpen && !wide ? (size.height * 0.34) / zoom : 0;
    void c.setFocalOffset(ox, oy, 0, anim);
  }, [selectedId, panelOpen, fit, officeFit, wide, size.height, reducedMotion]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minZoom={fit * 0.6}
      maxZoom={160}
      minPolarAngle={0.45}
      maxPolarAngle={1.15}
      smoothTime={0.35}
    />
  );
}

function Commons({ onOpenProjects }: { onOpenProjects: () => void }) {
  return (
    <group>
      {/* resepsionis: tempat membuat proyek baru */}
      <group
        position={[-15.2, 0, 0.9]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenProjects();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <Box p={[0, 0.5, 0]} s={[0.7, 1.0, 2.2]} c={MAT.woodDark} />
        <Box p={[0, 1.03, 0]} s={[0.8, 0.06, 2.3]} c={MAT.wood} />
        <Box p={[-0.1, 1.2, -0.6]} s={[0.12, 0.28, 0.2]} c="#E2C27A" />
        <Html position={[0, 1.7, 0]} center zIndexRange={[10, 0]} pointerEvents="none">
          <div className="room-sign">Resepsionis</div>
        </Html>
      </group>

      {/* pantry */}
      <group position={[15.7, 0, -1.4]}>
        <Box p={[0, 0.45, 0]} s={[0.7, 0.9, 2.0]} c={MAT.wall} />
        <Box p={[0, 0.92, 0]} s={[0.75, 0.05, 2.05]} c={MAT.woodDark} />
        <Box p={[0, 1.15, -0.5]} s={[0.4, 0.42, 0.35]} c="#2B2B2B" />
        <Box p={[0, 1.0, 0.3]} s={[0.12, 0.12, 0.12]} c="#F4EEDF" />
        <Html position={[0, 1.7, 0]} center zIndexRange={[10, 0]} pointerEvents="none">
          <div className="room-sign">Pantry</div>
        </Html>
      </group>

      {/* sofa */}
      <group position={[15.6, 0, 1.6]}>
        <Box p={[0, 0.25, 0]} s={[0.8, 0.5, 2.0]} c="#7A5C46" />
        <Box p={[0.3, 0.6, 0]} s={[0.2, 0.5, 2.0]} c="#6B4F3B" />
        <Box p={[-1.0, 0.22, 0]} s={[0.6, 0.06, 0.9]} c={MAT.wood} />
      </group>
    </group>
  );
}

export default function OfficeCanvas(props: OfficeProps) {
  const { selectedId, onSelect, reducedMotion, onOpenProjects } = props;
  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 2]}
      camera={{ position: [20, 22, 20], zoom: 30, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: true }}
      aria-label="Kantor 3D AI House"
    >
      <hemisphereLight args={["#FFF6E8", "#B8A890", 1.15]} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0005}
      />

      <Box p={[0, -0.05, 0]} s={[FLOOR_HALF_X * 2, 0.1, FLOOR_HALF_Z * 2]} c={MAT.concrete} shadow={false} />
      <Box p={[0, 0.005, 0]} s={[FLOOR_HALF_X * 2 - 1, 0.02, CORRIDOR_HALF * 2]} c={MAT.corridor} shadow={false} />

      {ROOMS.map((r) => (
        <Room key={r.id} room={r} selected={selectedId === r.id} onSelect={onSelect} onBoard={onOpenProjects} />
      ))}
      {ROOMS.map((r) => (
        <Character key={r.id} id={r.id} reducedMotion={reducedMotion} onSelect={onSelect} />
      ))}
      <Commons onOpenProjects={onOpenProjects} />
      <Campus />

      <CameraRig {...props} />
    </Canvas>
  );
}
