import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  type MeshStandardMaterial,
  SRGBColorSpace,
} from "three";
import { useHouse } from "../../state/store.ts";
import { atmo } from "./Atmosphere.tsx";
import { TONES } from "./looks.ts";
import { Box } from "./parts.tsx";

const STONE = "#F4F5F6";
const STONE_DARK = "#DADCE0";

// Nama kantor dipecah dua baris: dua kata terakhir di baris bawah (mis. "Synectra" / "AI House").
export function splitName(name: string): [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [words[0] ?? "", ""];
  const tail = words.length >= 3 ? 2 : 1;
  return [words.slice(0, -tail).join(" "), words.slice(-tail).join(" ")];
}

// Tulisan pahatan digambar ke kanvas (tanpa unduhan font 3D), lalu dipasang di muka tugu.
function useInscription(name: string) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1280;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);

  useEffect(() => {
    const draw = () => {
      const canvas = texture.image as HTMLCanvasElement;
      const g = canvas.getContext("2d");
      if (!g) return;
      // papan putih bersih dengan empat garis warna di atas dan bawah
      g.fillStyle = "#FFFFFF";
      g.fillRect(0, 0, canvas.width, canvas.height);
      const band = canvas.width / TONES.length;
      TONES.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(i * band, 0, band, 36);
        g.fillRect(i * band, canvas.height - 36, band, 36);
      });
      g.fillStyle = "#202124";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const family = '"Bricolage Grotesque", system-ui, sans-serif';
      const [top, bottom] = splitName(name);
      // ukuran huruf mengecil bila nama panjang, agar tetap di dalam bingkai
      const fit = (text: string, weight: number, size: number) => {
        g.font = `${weight} ${size}px ${family}`;
        const width = g.measureText(text).width;
        if (width > 860)
          g.font = `${weight} ${Math.floor((size * 860) / width)}px ${family}`;
      };
      fit(top, 700, 190);
      g.fillText(top, canvas.width / 2, bottom ? 520 : 640);
      if (bottom) {
        fit(bottom, 600, 120);
        g.fillText(bottom, canvas.width / 2, 740);
      }
      TONES.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(canvas.width / 2 - 160 + i * 80, 880, 80, 10);
      });
      texture.needsUpdate = true;
    };
    draw();
    // gambar ulang setelah font judul selesai dimuat
    void document.fonts?.ready.then(draw);
  }, [texture, name]);

  return texture;
}

export function Monument({
  position,
  rotation = 0,
}: { position: [number, number, number]; rotation?: number }) {
  const texture = useInscription(useHouse()?.name ?? "AI House");
  const glow = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (glow.current) glow.current.emissiveIntensity = 0.15 + atmo.lamp * 0.55; // tulisan diterangi lampu sorot saat malam
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* undakan */}
      <Box p={[0, 0.15, 0]} s={[4.6, 0.3, 3.2]} c={STONE_DARK} />
      <Box p={[0, 0.45, 0]} s={[3.8, 0.3, 2.4]} c={STONE} />
      <Box p={[0, 0.75, 0]} s={[3.1, 0.3, 1.7]} c={STONE_DARK} />
      {/* badan tugu */}
      <Box p={[0, 3.05, 0]} s={[2.4, 4.3, 1.1]} c={STONE} />
      <Box p={[0, 5.35, 0]} s={[2.7, 0.3, 1.35]} c={STONE_DARK} />
      <mesh position={[0, 5.9, 0]} castShadow>
        <coneGeometry args={[0.95, 0.8, 4]} />
        <meshStandardMaterial
          color={TONES[0]}
          roughness={0.45}
          metalness={0.1}
        />
      </mesh>
      {/* prasasti di muka depan (+z) */}
      <mesh position={[0, 3.05, 0.56]} userData={{ dynamic: true }}>
        <planeGeometry args={[2.1, 2.62]} />
        <meshStandardMaterial
          ref={glow}
          map={texture}
          emissive="#FFFFFF"
          emissiveMap={texture}
          emissiveIntensity={0.15}
          roughness={0.8}
        />
      </mesh>
      {/* lampu sorot kecil di kaki tugu */}
      {[-1.3, 1.3].map((x) => (
        <Box key={x} p={[x, 1.0, 1.0]} s={[0.25, 0.18, 0.25]} c="#4A4E54" />
      ))}
    </group>
  );
}
