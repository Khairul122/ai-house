import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, type DirectionalLight, FogExp2, type HemisphereLight, type InstancedMesh, Object3D, type PointLight, Vector3 } from "three";
import { play, setRain } from "../../lib/sound.ts";
import { env, useEnv } from "../../state/env.ts";
import { lightingFor, type Phase, type Weather } from "./environment.ts";
import { CAMPUS_HALF_X, CAMPUS_HALF_Z } from "./layout.ts";

// Keadaan suasana yang dibaca komponen lain setiap frame (lampu, karakter).
export const atmo = { lamp: 0, rain: 0, weather: "cerah" as Weather, phase: "siang" as Phase };

const DROPS = 1500;
const RAIN_TOP = 26;

function Rain() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const drops = useMemo(
    () =>
      Array.from({ length: DROPS }, () => ({
        x: (Math.random() - 0.5) * CAMPUS_HALF_X * 2,
        y: Math.random() * RAIN_TOP,
        z: (Math.random() - 0.5) * CAMPUS_HALF_Z * 2,
        v: 18 + Math.random() * 8
      })),
    []
  );

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    m.visible = atmo.rain > 0.02;
    if (!m.visible) return;
    const dt = Math.min(delta, 0.05);
    const shown = Math.floor(DROPS * atmo.rain);
    for (let i = 0; i < DROPS; i++) {
      const d = drops[i];
      d.y -= d.v * dt;
      if (d.y < 0) d.y += RAIN_TOP;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(i < shown ? 1 : 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} frustumCulled={false}>
      <boxGeometry args={[0.03, 0.55, 0.03]} />
      <meshBasicMaterial color="#C9D6E2" transparent opacity={0.55} />
    </instancedMesh>
  );
}

const CLOUDS: [number, number, number, number][] = [
  [-40, 22, -10, 1.2],
  [-15, 25, 18, 1],
  [10, 23, -25, 1.4],
  [32, 26, 8, 1.1],
  [50, 24, -18, 0.9],
  [-55, 27, 28, 1.3]
];

function Clouds() {
  const group = useRef<import("three").Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const grey = atmo.weather === "hujan" || atmo.weather === "dingin";
    for (const c of g.children) {
      c.position.x += Math.min(delta, 0.05) * (atmo.weather === "hujan" ? 2.2 : 0.9);
      if (c.position.x > 70) c.position.x = -70;
      c.visible = atmo.weather !== "panas" || c.position.z > 0; // cuaca panas: langit lebih bersih
      const mat = (c.children[0] as import("three").Mesh).material as import("three").MeshStandardMaterial;
      mat.color.lerp(new Color(grey ? "#8E979F" : "#FFFFFF"), 0.02);
    }
  });
  return (
    <group ref={group}>
      {CLOUDS.map(([x, y, z, s]) => (
        <group key={`${x}${z}`} position={[x, y, z]} scale={s}>
          <mesh>
            <boxGeometry args={[7, 1.6, 4]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.85} />
          </mesh>
          <mesh position={[1.5, 0.9, 0.3]}>
            <boxGeometry args={[4, 1.4, 3]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Cahaya matahari/bulan, langit, kabut, hujan, awan, dan suara sekitar mengikuti waktu dan cuaca.
export function Atmosphere() {
  const { scene } = useThree();
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const night = useRef<PointLight[]>([]);
  const target = useMemo(() => ({ sky: new Color(), sun: new Color(), hs: new Color(), hg: new Color(), pos: new Vector3() }), []);
  const nextAmbient = useRef(0);
  const sound = useEnv((s) => s.sound);

  useEffect(() => {
    scene.background = new Color("#E9EEF0");
    scene.fog = new FogExp2("#E9EEF0", 0);
    return () => {
      scene.fog = null;
      setRain(false);
    };
  }, [scene]);

  useFrame(({ clock }, delta) => {
    const weather = env.weather();
    const phase = env.phase();
    atmo.weather = weather;
    atmo.phase = phase;
    const l = lightingFor(phase, weather);
    const k = Math.min(1, Math.min(delta, 0.05) * 1.2); // transisi pelan, tidak meloncat

    target.sky.set(l.sky);
    (scene.background as Color).lerp(target.sky, k);
    const fog = scene.fog as FogExp2;
    fog.color.copy(scene.background as Color);
    fog.density += (l.fog - fog.density) * k;

    if (sun.current) {
      sun.current.intensity += (l.sun - sun.current.intensity) * k;
      sun.current.color.lerp(target.sun.set(l.sunColor), k);
      sun.current.position.lerp(target.pos.set(...l.sunPos), k);
    }
    if (hemi.current) {
      hemi.current.intensity += (l.hemi - hemi.current.intensity) * k;
      hemi.current.color.lerp(target.hs.set(l.hemiSky), k);
      hemi.current.groundColor.lerp(target.hg.set(l.hemiGround), k);
    }
    atmo.lamp += ((l.lamps ? 1 : 0) - atmo.lamp) * k;
    atmo.rain += ((weather === "hujan" ? 1 : 0) - atmo.rain) * k;
    for (const p of night.current) if (p) p.intensity = atmo.lamp * 14;

    // suara sekitar: hujan terus-menerus, burung siang hari, jangkrik malam hari
    setRain(sound && weather === "hujan");
    const t = clock.elapsedTime;
    if (sound && t > nextAmbient.current) {
      if (weather !== "hujan" && phase !== "malam") play("bird", 0.6);
      else if (phase === "malam" && weather !== "hujan") play("cricket", 0.7);
      nextAmbient.current = t + 4 + Math.random() * 7;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#FFF6E8", "#B8A890", 1.15]} />
      <directionalLight
        ref={sun}
        position={[20, 60, 15]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0005}
      />
      {/* lampu koridor dan ruang santai yang hanya menyala malam/hujan */}
      {[-10, 0, 10, 15.5].map((x, i) => (
        <pointLight
          key={x}
          ref={(p) => {
            if (p) night.current[i] = p;
          }}
          position={[x, 2.4, 0]}
          color="#FFD9A0"
          intensity={0}
          distance={9}
          decay={1.6}
        />
      ))}
      <Rain />
      <Clouds />
    </>
  );
}
