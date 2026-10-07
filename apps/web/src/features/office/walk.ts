import { CORRIDOR_HALF, insideOf, laneOf, ROOM_W, ROOMS, roomById, type Vec2 } from "./layout.ts";

// Zona = id ruangan, atau "hall" untuk koridor dan pojok bersama.
export type Zone = string;

// Zona dihitung dari posisi fisik, bukan dari tujuan terakhir, supaya rute yang
// berganti di tengah jalan tetap lewat pintu.
export function zoneAt(x: number, z: number): Zone {
  if (Math.abs(z) <= CORRIDOR_HALF) return "hall";
  const room = ROOMS.find((r) => Math.abs(x - r.x) <= ROOM_W / 2 && Math.sign(z) === Math.sign(r.z));
  return room?.id ?? "hall";
}

// Rute sederhana tanpa pathfinding: keluar lewat pintu, susuri koridor, masuk lewat pintu tujuan.
export function buildPath(from: Zone, to: Zone, target: Vec2): Vec2[] {
  if (from === to) return [target];
  const path: Vec2[] = [];
  const a = roomById(from);
  if (a) path.push(insideOf(a), laneOf(a));
  const b = roomById(to);
  if (b) {
    path.push(laneOf(b), insideOf(b), target);
  } else {
    path.push([Math.max(-13, Math.min(13, target[0])), 0], target);
  }
  return path;
}
