import {
  CORRIDOR_HALF,
  EXITS,
  FLOOR_HALF_X,
  FLOOR_HALF_Z,
  insideOf,
  laneOf,
  PROMENADE_Z,
  ROOM_W,
  ROOMS,
  roomById,
  type Vec2
} from "./layout.ts";

// Zona = id ruangan, "hall" untuk koridor dan pojok bersama di dalam gedung, atau "outside" untuk kampus.
export type Zone = string;

// Zona dihitung dari posisi fisik, bukan dari tujuan terakhir, supaya rute yang
// berganti di tengah jalan tetap lewat pintu.
export function zoneAt(x: number, z: number): Zone {
  if (Math.abs(x) > FLOOR_HALF_X || Math.abs(z) > FLOOR_HALF_Z) return "outside";
  if (Math.abs(z) <= CORRIDOR_HALF) return "hall";
  const room = ROOMS.find((r) => Math.abs(x - r.x) <= ROOM_W / 2 && Math.sign(z) === Math.sign(r.z));
  return room?.id ?? "hall";
}

// Rute di dalam gedung: keluar lewat pintu ruangan, susuri koridor, masuk lewat pintu tujuan.
function indoor(from: Zone, to: Zone, target: Vec2): Vec2[] {
  if (from === to) return [target];
  const path: Vec2[] = [];
  const a = roomById(from);
  if (a) path.push(insideOf(a), laneOf(a));
  const b = roomById(to);
  if (b) path.push(laneOf(b), insideOf(b), target);
  else path.push([Math.max(-13, Math.min(13, target[0])), 0], target);
  return path;
}

// Rute sederhana tanpa pathfinding. Antara dalam dan luar gedung selalu lewat pintu ujung koridor
// dan jalan setapak di depan gedung, sehingga karakter tidak menembus dinding.
export function buildPath(from: Zone, to: Zone, target: Vec2, fromPos: Vec2 = target): Vec2[] {
  const fromOut = from === "outside";
  const toOut = to === "outside";

  if (fromOut && toOut) return [[fromPos[0], PROMENADE_Z], [target[0], PROMENADE_Z], target];

  if (!fromOut && toOut) {
    const exit = target[0] >= 0 ? EXITS.east : EXITS.west;
    return [...indoor(from, "hall", exit.inner), exit.outer, [exit.outer[0], PROMENADE_Z], [target[0], PROMENADE_Z], target];
  }

  if (fromOut && !toOut) {
    const exit = fromPos[0] >= 0 ? EXITS.east : EXITS.west;
    return [[fromPos[0], PROMENADE_Z], [exit.outer[0], PROMENADE_Z], exit.outer, exit.inner, ...indoor("hall", to, target)];
  }

  return indoor(from, to, target);
}
