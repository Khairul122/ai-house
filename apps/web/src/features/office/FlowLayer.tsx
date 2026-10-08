import { QuadraticBezierLine } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  Color,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  QuadraticBezierCurve3,
  Vector3,
} from "three";
import { FLOW_MS, type FlowKind, activeFlows } from "../../state/flows.ts";
import { FLOOR_H, roomById } from "./layout.ts";

const COLOR: Record<FlowKind, Color> = {
  out: new Color("#5B8DEF"),
  done: new Color("#3FB37F"),
  fail: new Color("#E5534B"),
  ask: new Color("#E8A33A"),
};
const SLOTS = 8;

// Satu slot busur. Slot tetap dipasang dan disembunyikan saat kosong, jadi tidak ada render ulang
// React selama animasi; posisi dan warna diubah langsung di useFrame.
function FlowSlot({ index }: { index: number }) {
  // biome-ignore lint/suspicious/noExplicitAny: tipe ref Line2 dari drei tidak diekspor
  const line = useRef<any>(null);
  const pulse = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const group = useRef<Group>(null);
  const state = useRef({
    id: "",
    curve: new QuadraticBezierCurve3(),
    a: new Vector3(),
    b: new Vector3(),
    mid: new Vector3(),
  });

  useFrame(() => {
    const g = group.current;
    const flow = activeFlows()[index];
    const from = flow && roomById(flow.from);
    const to = flow && roomById(flow.to);
    if (!g || !flow || !from || !to) {
      if (g) g.visible = false;
      return;
    }
    const s = state.current;
    if (s.id !== flow.id) {
      // busur baru: titik tengah naik sebanding jaraknya
      s.id = flow.id;
      s.a.set(from.x, from.level * FLOOR_H + 0.9, from.z);
      s.b.set(to.x, to.level * FLOOR_H + 0.9, to.z);
      s.mid.addVectors(s.a, s.b).multiplyScalar(0.5);
      s.mid.y = Math.max(s.a.y, s.b.y) + 1.7 + s.a.distanceTo(s.b) * 0.18;
      s.curve.v0.copy(s.a);
      s.curve.v1.copy(s.mid);
      s.curve.v2.copy(s.b);
      line.current?.setPoints(s.a, s.b, s.mid);
      const c = COLOR[flow.kind];
      line.current?.material.color.copy(c);
      (pulse.current?.material as MeshBasicMaterial | undefined)?.color.copy(c);
      (ring.current?.material as MeshBasicMaterial | undefined)?.color.copy(c);
    }
    g.visible = true;
    const t = (performance.now() - flow.at) / FLOW_MS; // 0..1
    const travel = Math.min(1, t / 0.6); // denyut tiba di 60% umur busur
    const fade = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
    if (line.current) line.current.material.opacity = 0.75 * fade;
    if (pulse.current) {
      s.curve.getPoint(travel, pulse.current.position);
      pulse.current.visible = travel < 1;
    }
    if (ring.current) {
      const r = travel < 1 ? 0 : (t - 0.6) / 0.4; // riak di lantai ruangan tujuan
      ring.current.visible = r > 0;
      ring.current.position.set(to.x, to.level * FLOOR_H + 0.08, to.z);
      ring.current.scale.setScalar(0.4 + r * 2.2);
      (ring.current.material as MeshBasicMaterial).opacity = 0.7 * (1 - r);
    }
  });

  return (
    <group ref={group} visible={false}>
      <QuadraticBezierLine
        ref={line}
        start={[0, 0, 0]}
        end={[0, 0, 1]}
        lineWidth={4}
        transparent
        opacity={0}
        depthWrite={false}
      />
      <mesh ref={pulse}>
        <sphereGeometry args={[0.16, 14, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Busur aliran tugas antar ruangan: kirim (biru), selesai (hijau), gagal (merah), minta izin (kuning).
export function FlowLayer() {
  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => (
        <FlowSlot key={i} index={i} />
      ))}
    </>
  );
}
