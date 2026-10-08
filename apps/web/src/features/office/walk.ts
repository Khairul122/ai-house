import {
  allRooms,
  CORRIDOR_HALF,
  EXITS,
  FLOOR_HALF_X,
  FLOOR_HALF_Z,
  insideOf,
  laneOf,
  LIFT,
  PROMENADE_Z,
  roomById,
  type Vec2,
  type Waypoint,
} from "./layout.ts";

// Zona = id ruangan, "hall" untuk koridor dan pojok bersama di dalam gedung, atau "outside" untuk kampus.
export type Zone = string;

// Zona dihitung dari posisi fisik (dan lantai), bukan dari tujuan terakhir, supaya rute yang
// berganti di tengah jalan tetap lewat pintu.
export function zoneAt(x: number, z: number, level = 0): Zone {
  if (Math.abs(x) > FLOOR_HALF_X || Math.abs(z) > FLOOR_HALF_Z)
    return "outside";
  if (Math.abs(z) <= CORRIDOR_HALF) return "hall";
  const room = allRooms().find(
    (r) =>
      r.level === level &&
      Math.abs(x - r.x) <= r.w / 2 &&
      Math.sign(z) === Math.sign(r.z),
  );
  return room?.id ?? "hall";
}

// Rute di satu lantai: keluar lewat pintu ruangan, susuri koridor, masuk lewat pintu tujuan.
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

// Rute di dalam gedung; beda lantai lewat lift di ujung barat koridor.
function inside(
  from: Zone,
  fromLevel: number,
  to: Zone,
  toLevel: number,
  target: Vec2,
): Waypoint[] {
  if (fromLevel === toLevel) return indoor(from, to, target);
  return [
    ...indoor(from, "hall", LIFT.door),
    LIFT.cab,
    [LIFT.cab[0], LIFT.cab[1], toLevel],
    LIFT.door,
    ...indoor("hall", to, target),
  ];
}

// Rute sederhana tanpa pathfinding. Antara dalam dan luar gedung selalu lewat lantai dasar, pintu ujung
// koridor, dan jalan setapak di depan gedung, sehingga karakter tidak menembus dinding.
export function buildPath(
  from: Zone,
  to: Zone,
  target: Vec2,
  fromPos: Vec2 = target,
  fromLevel = 0,
  toLevel = 0,
): Waypoint[] {
  const fromOut = from === "outside";
  const toOut = to === "outside";

  if (fromOut && toOut)
    return [[fromPos[0], PROMENADE_Z], [target[0], PROMENADE_Z], target];

  if (!fromOut && toOut) {
    const exit = target[0] >= 0 ? EXITS.east : EXITS.west;
    return [
      ...inside(from, fromLevel, "hall", 0, exit.inner),
      exit.outer,
      [exit.outer[0], PROMENADE_Z],
      [target[0], PROMENADE_Z],
      target,
    ];
  }

  if (fromOut && !toOut) {
    const exit = fromPos[0] >= 0 ? EXITS.east : EXITS.west;
    return [
      [fromPos[0], PROMENADE_Z],
      [exit.outer[0], PROMENADE_Z],
      exit.outer,
      exit.inner,
      ...inside("hall", 0, to, toLevel, target),
    ];
  }

  return inside(from, fromLevel, to, toLevel, target);
}
