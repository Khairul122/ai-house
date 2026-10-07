import { insideOf, laneOf, roomById, type Vec2 } from "./layout.ts";

// Zona = id ruangan, atau "hall" untuk koridor dan pojok bersama.
export type Zone = string;

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
