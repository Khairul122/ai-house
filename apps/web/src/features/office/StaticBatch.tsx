import { useLayoutEffect, useRef } from "react";
import { type BufferGeometry, type Group, type Material, Matrix4, Mesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Kunci material: material bersama memakai uuid; material sebaris disamakan bila tampilannya sama.
function keyOf(m: Material): string {
  const s = m as Material & { color?: { getHexString(): string }; emissive?: { getHexString(): string }; emissiveIntensity?: number; roughness?: number; metalness?: number };
  return [s.type, s.color?.getHexString(), s.emissive?.getHexString(), s.emissiveIntensity, s.roughness, s.metalness, s.transparent, s.opacity].join("|");
}

// Menggabungkan semua mesh statis di dalamnya menjadi satu mesh per material.
// Ratusan kotak pemandangan jadi beberapa draw call. Mesh dengan userData.dynamic = true dibiarkan
// (mis. lampu, air, prasasti yang diubah tiap frame). Hanya untuk benda yang tidak bergerak.
export function StaticBatch({ children }: { children: React.ReactNode }) {
  const source = useRef<Group>(null);
  const merged = useRef<Group>(null);

  useLayoutEffect(() => {
    const root = source.current;
    const out = merged.current;
    if (!root || !out) return;
    root.updateWorldMatrix(true, true);
    const toLocal = new Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, { material: Material; geos: BufferGeometry[]; cast: boolean }>();
    const hidden: { mesh: Mesh; parent: import("three").Object3D }[] = [];

    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || mesh.userData.dynamic || Array.isArray(mesh.material)) return;
      let skip = false;
      for (let p = mesh.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) skip = true;
      if (skip) return;
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv || !g.attributes.normal) return;
      g.applyMatrix4(new Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
      const key = keyOf(mesh.material);
      const b = buckets.get(key) ?? { material: mesh.material, geos: [], cast: false };
      b.geos.push(g);
      b.cast ||= mesh.castShadow;
      buckets.set(key, b);
      if (mesh.parent) hidden.push({ mesh, parent: mesh.parent });
    });

    const made: Mesh[] = [];
    for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos, false);
      for (const g of b.geos) g.dispose();
      if (!geo) continue;
      const m = new Mesh(geo, b.material);
      m.castShadow = b.cast;
      m.receiveShadow = true;
      out.add(m);
      made.push(m);
    }
    // dikeluarkan dari scene (bukan sekadar disembunyikan) agar tidak ikut dihitung tiap frame
    for (const h of hidden) h.parent.remove(h.mesh);

    return () => {
      for (const m of made) {
        out.remove(m);
        m.geometry.dispose();
      }
      for (const h of hidden) h.parent.add(h.mesh);
    };
  }, []);

  return (
    <>
      <group ref={source}>{children}</group>
      <group ref={merged} />
    </>
  );
}
