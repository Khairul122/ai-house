import { CameraControls, Html, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
import { useEffect, useRef, useState } from "react";
import { Atmosphere } from "./Atmosphere.tsx";
import { Campus } from "./Campus.tsx";
import { Character } from "./Character.tsx";
import { camera, useCamera } from "../../state/camera.ts";
import { setFocus } from "../../state/focus.ts";
import { visibleStatus } from "../../state/reduce.ts";
import { office, useHouse, useRooms } from "../../state/store.ts";
import { FlowLayer } from "./FlowLayer.tsx";
import { CORRIDOR_HALF, FLOOR_HALF_X, FLOOR_HALF_Z, getRooms, roomById } from "./layout.ts";
import { MAT, TONES, tint, toneAt } from "./looks.ts";
import { Box } from "./parts.tsx";
import { BigPlant } from "./props.tsx";
import { Room } from "./Room.tsx";
import { StaticBatch } from "./StaticBatch.tsx";

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
  const view = useCamera((c) => c.view);
  const resetAt = useCamera((c) => c.resetAt);
  const tour = useCamera((c) => c.tour);
  const tourTarget = useCamera((c) => c.tourTarget);
  const portrait = size.height > size.width;
  // Di layar tegak, koridor diputar memanjang dari atas ke bawah agar gedung tidak mengecil.
  const officeFit = portrait ? Math.min(size.width / 17, size.height / 38) : Math.min(size.width / 33, size.height / 21);
  // Tampilan awal: gedung beserta kampus di sekitarnya; bisa di-zoom keluar sampai seluruh kampus terlihat.
  const fit = portrait ? Math.min(size.width / 30, size.height / 62) : Math.min(size.width / 60, size.height / 38);
  const wide = size.width >= 768;

  // Sudut kamera: isometrik (bawaan), dari atas seperti denah, atau dari depan gedung.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const base = portrait ? 1.25 : Math.PI / 4;
    const [azimuth, polar] = view === "top" ? [portrait ? Math.PI / 2 : 0, 0.04] : view === "front" ? [0, 1.05] : [base, 0.9];
    void c.rotateTo(azimuth, polar, !reducedMotion && resetAt > 0);
  }, [portrait, view, resetAt, reducedMotion]);

  // Menggeser kamera sendiri menghentikan tur.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const stop = () => camera.get().tour && camera.setTour(false);
    c.addEventListener("controlstart", stop);
    return () => c.removeEventListener("controlstart", stop);
  }, []);

  // Tur otomatis: tiap 5 detik pindah ke ruangan berikutnya, utamakan yang sedang bekerja atau butuh perhatian.
  useEffect(() => {
    if (!tour || selectedId) return;
    let i = 0;
    const next = () => {
      const rooms = getRooms();
      const agents = office.get().agents;
      const busy = rooms.filter((r) => visibleStatus(agents[r.id]) !== "idle");
      const pool = busy.length ? busy : rooms;
      if (pool.length) camera.setTourTarget(pool[i++ % pool.length].id);
    };
    next();
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [tour, selectedId]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const anim = !reducedMotion;
    const room = selectedId ? roomById(selectedId) : tour && tourTarget ? roomById(tourTarget) : null;
    const zoom = room ? Math.max(officeFit * (selectedId ? 2.4 : 1.8), selectedId ? 55 : 40) : fit;
    if (room) void c.moveTo(room.x, 0.6, room.z, anim);
    else void c.moveTo(0, 0, 0, anim);
    void c.zoomTo(zoom, anim);
    // geser fokus supaya ruangan tidak tertutup panel
    const ox = panelOpen && wide ? PANEL_W / 2 / zoom : 0;
    const oy = panelOpen && !wide ? (size.height * 0.34) / zoom : 0;
    void c.setFocalOffset(ox, oy, 0, anim);
  }, [selectedId, panelOpen, fit, officeFit, wide, size.height, reducedMotion, tour, tourTarget, resetAt]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minZoom={fit * 0.6}
      maxZoom={160}
      minPolarAngle={view === "top" ? 0.02 : 0.45}
      maxPolarAngle={1.15}
      smoothTime={0.35}
    />
  );
}

function Commons({ onOpenProjects }: { onOpenProjects: () => void }) {
  return (
    <group>
      {/* resepsionis: tempat membuat proyek baru; diklik lewat satu kotak tak terlihat */}
      <mesh
        visible={false}
        position={[-15.2, 0.7, 0.9]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenProjects();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[1, 1.4, 2.4]} />
      </mesh>
      <Html position={[-15.2, 1.7, 0.9]} center zIndexRange={[10, 0]} pointerEvents="none">
        <div className="room-sign">Resepsionis</div>
      </Html>
      <Html position={[15.7, 1.7, -1.4]} center zIndexRange={[10, 0]} pointerEvents="none">
        <div className="room-sign">Pantry</div>
      </Html>

      <StaticBatch>
        {/* lantai gedung: pelat putih hangat, koridor kayu ek dengan karpet panjang */}
        <Box p={[0, -0.06, 0]} s={[FLOOR_HALF_X * 2 + 0.4, 0.12, FLOOR_HALF_Z * 2 + 0.4]} c={MAT.concrete} shadow={false} />
        <Box p={[0, 0.005, 0]} s={[FLOOR_HALF_X * 2 - 1, 0.02, CORRIDOR_HALF * 2]} c={MAT.corridor} shadow={false} round={false} />
        <Box p={[0, 0.02, 0]} s={[FLOOR_HALF_X * 2 - 6, 0.012, 0.9]} c={tint(TONES[4], 0.55)} shadow={false} round={false} />
        {/* tanaman besar di empat sudut gedung */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1]
        ].map(([sx, sz]) => (
          <BigPlant key={`${sx}${sz}`} p={[sx * (FLOOR_HALF_X - 0.5), 0, sz * (FLOOR_HALF_Z - 0.5)]} />
        ))}
        {/* resepsionis: meja putih melengkung dengan panel pastel */}
        <group position={[-15.2, 0, 0.9]}>
          <Box p={[0, 0.5, 0]} s={[0.7, 1.0, 2.2]} c={MAT.wall} />
          <Box p={[0.37, 0.45, 0]} s={[0.04, 0.7, 2.0]} c={TONES[0]} shadow={false} />
          <Box p={[0, 1.03, 0]} s={[0.8, 0.06, 2.3]} c={MAT.wood} />
          <Box p={[-0.1, 1.2, -0.6]} s={[0.14, 0.26, 0.2]} c={MAT.screenOff} />
          <mesh position={[-0.1, 1.12, 0.6]} castShadow>
            <sphereGeometry args={[0.12, 12, 8]} />
            <meshStandardMaterial color={TONES[3]} roughness={0.6} />
          </mesh>
        </group>
        {/* pantry: konter putih, mesin kopi, kursi tinggi pastel */}
        <group position={[15.7, 0, -1.4]}>
          <Box p={[0, 0.45, 0]} s={[0.7, 0.9, 2.0]} c={MAT.wall} />
          <Box p={[0, 0.92, 0]} s={[0.75, 0.05, 2.05]} c={MAT.wood} />
          <Box p={[0, 1.15, -0.5]} s={[0.4, 0.42, 0.35]} c={MAT.screenOff} />
          <Box p={[0, 1.0, 0.3]} s={[0.14, 0.14, 0.14]} c="#FFFFFF" />
          {[-0.5, 0.3].map((z, i) => (
            <group key={z} position={[-0.75, 0, z]}>
              <Box p={[0, 0.3, 0]} s={[0.06, 0.6, 0.06]} c={MAT.metal} />
              <mesh position={[0, 0.64, 0]} castShadow>
                <cylinderGeometry args={[0.2, 0.2, 0.08, 16]} />
                <meshStandardMaterial color={TONES[i + 1]} roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
        {/* sofa pastel bersandaran bulat */}
        <group position={[15.6, 0, 1.6]}>
          <Box p={[0, 0.25, 0]} s={[0.8, 0.5, 2.0]} c={TONES[1]} />
          <Box p={[0.3, 0.62, 0]} s={[0.22, 0.55, 2.0]} c={tint(TONES[1], 0.15)} />
          {[-0.6, 0.6].map((z) => (
            <Box key={z} p={[0.05, 0.6, z]} s={[0.2, 0.3, 0.4]} c={TONES[2]} />
          ))}
          <mesh position={[-1.0, 0.25, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.06, 20]} />
            <meshStandardMaterial color={MAT.wood} roughness={0.7} />
          </mesh>
          <Box p={[-1.0, 0.12, 0]} s={[0.08, 0.24, 0.08]} c={MAT.metal} />
        </group>
      </StaticBatch>
    </group>
  );
}

type Quality = "low" | "mid" | "high";
const DPR: Record<Quality, number> = { low: 1, mid: 1.25, high: 1.5 };

// Efek akhir menyesuaikan kemampuan perangkat:
// high = AO + pendar + vinyet, mid = pendar + vinyet, low = tanpa efek.
function Effects({ quality }: { quality: Quality }) {
  if (quality === "low") return null;
  if (quality === "mid") {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.5} />
        <Vignette offset={0.3} darkness={0.4} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={1.4} intensity={2.2} distanceFalloff={1.2} halfRes quality="performance" />
      <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.5} />
      <Vignette offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
}

// Batas frame: 30 fps saat diam (karakter tetap bergerak halus), 60 fps selama 1,5 detik setelah
// Anda menyeret, menggulir, atau mengklik. Berhenti total saat tab tidak terlihat.
function FrameDriver() {
  const { invalidate, gl } = useThree();
  useEffect(() => {
    let busyUntil = 0;
    let last = 0;
    let raf = 0;
    const bump = () => {
      busyUntil = performance.now() + 1500;
      invalidate();
    };
    const move = (e: PointerEvent) => {
      if (e.buttons) bump();
    };
    const el = gl.domElement;
    el.addEventListener("pointerdown", bump);
    el.addEventListener("wheel", bump, { passive: true });
    el.addEventListener("pointermove", move);
    el.addEventListener("touchmove", bump, { passive: true });
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const interval = t < busyUntil ? 1000 / 60 : 1000 / 30;
      if (t - last >= interval - 2) {
        last = t;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", bump);
      el.removeEventListener("wheel", bump);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("touchmove", bump);
    };
  }, [invalidate, gl]);
  return null;
}

// Hanya saat pengembangan: buka statistik renderer untuk mengukur performa dari konsol.
function DevStats() {
  const { gl, scene, camera, internal } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __house: unknown }).__house = { gl, scene, camera, internal };
  }, [gl, scene, camera, internal]);
  return null;
}

export default function OfficeCanvas(props: OfficeProps) {
  const { selectedId, onSelect, reducedMotion, onOpenProjects } = props;
  // Mulai di kualitas menengah; naik bila perangkat kuat, turun bila frame mulai tersendat.
  const [quality, setQuality] = useState<Quality>(() => (window.innerWidth < 768 ? "low" : "mid"));
  const rooms = useRooms();
  const houseName = useHouse()?.name ?? "AI House";
  return (
    <Canvas
      shadows
      orthographic
      frameloop="demand"
      dpr={Math.min(DPR[quality], window.devicePixelRatio || 1)}
      camera={{ position: [20, 22, 20], zoom: 30, near: 0.1, far: 400 }}
      gl={{ antialias: quality !== "high", alpha: false, powerPreference: "high-performance", stencil: false }}
      aria-label={`Kantor 3D ${houseName}`}
      onPointerMissed={() => setFocus(null)}
    >
      <PerformanceMonitor
        bounds={() => [24, 50]}
        flipflops={3}
        onIncline={() => setQuality((q) => (q === "low" ? "mid" : "high"))}
        onDecline={() => setQuality((q) => (q === "high" ? "mid" : "low"))}
        onFallback={() => setQuality("low")}
      />
      <FrameDriver />
      <Atmosphere />

      {rooms.map((r, i) => (
        <Room key={r.id} room={r} tone={toneAt(i)} selected={selectedId === r.id} onSelect={onSelect} onBoard={onOpenProjects} />
      ))}
      {rooms.map((r) => (
        <Character key={r.id} id={r.id} reducedMotion={reducedMotion} onSelect={onSelect} />
      ))}
      <FlowLayer />
      <Commons onOpenProjects={onOpenProjects} />
      <Campus />

      <CameraRig {...props} />
      <DevStats />
      <Effects quality={quality} />
    </Canvas>
  );
}
