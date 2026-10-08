import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type MeshStandardMaterial, SRGBColorSpace } from "three";
import { atmo } from "./Atmosphere.tsx";
import { Box } from "./parts.tsx";

const STONE = "#CFC6B4";
const STONE_DARK = "#A89E8A";

// Tulisan pahatan digambar ke kanvas (tanpa unduhan font 3D), lalu dipasang di muka tugu.
function useInscription() {
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
      g.fillStyle = "#3A3428";
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.strokeStyle = "#C9A227";
      g.lineWidth = 10;
      g.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
      g.fillStyle = "#E8D9A8";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const family = '"Bricolage Grotesque", system-ui, sans-serif';
      g.font = `700 190px ${family}`;
      g.fillText("Synectra", canvas.width / 2, 520);
      g.font = `600 120px ${family}`;
      g.fillText("AI House", canvas.width / 2, 740);
      g.fillRect(canvas.width / 2 - 160, 880, 320, 8);
      texture.needsUpdate = true;
    };
    draw();
    // gambar ulang setelah font judul selesai dimuat
    void document.fonts?.ready.then(draw);
  }, [texture]);

  return texture;
}

export function Monument({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const texture = useInscription();
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
        <meshStandardMaterial color="#C9A227" roughness={0.45} metalness={0.3} />
      </mesh>
      {/* prasasti di muka depan (+z) */}
      <mesh position={[0, 3.05, 0.56]} userData={{ dynamic: true }}>
        <planeGeometry args={[2.1, 2.62]} />
        <meshStandardMaterial ref={glow} map={texture} emissive="#E8D9A8" emissiveMap={texture} emissiveIntensity={0.15} roughness={0.8} />
      </mesh>
      {/* lampu sorot kecil di kaki tugu */}
      {[-1.3, 1.3].map((x) => (
        <Box key={x} p={[x, 1.0, 1.0]} s={[0.25, 0.18, 0.25]} c="#4A4E54" />
      ))}
    </group>
  );
}
