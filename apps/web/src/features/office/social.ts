import { CORRIDOR_HALF, PARK, PROMENADE_Z, type Vec2 } from "./layout.ts";
import { type Zone, zoneAt } from "./walk.ts";

// Koordinasi antar karakter yang sedang santai: siapa ngobrol dengan siapa, dan tempat mana yang terpakai.
// Disimpan di luar React karena dibaca setiap frame.

export interface Meet {
  key: string;
  a: string;
  b: string;
  spot: Vec2; // titik tengah; kedua karakter berdiri berhadapan di kiri-kanannya
  zone: Zone;
  until: number;
  startedAt: number; // 0 sampai keduanya tiba
  arrived: Set<string>;
}

const available = new Set<string>();
const meets = new Map<string, Meet>(); // per id karakter
const claims = new Map<string, string>(); // kunci tempat -> id karakter
let counter = 0;

export function setAvailable(id: string, free: boolean) {
  if (free) available.add(id);
  else available.delete(id);
}

export function claim(key: string, id: string): boolean {
  const owner = claims.get(key);
  if (owner && owner !== id) return false;
  claims.set(key, id);
  return true;
}

export function releaseAll(id: string) {
  for (const [k, owner] of claims) if (owner === id) claims.delete(k);
}

function meetingSpot(from: Vec2): Vec2 {
  const inside = zoneAt(from[0], from[1]) !== "outside";
  if (inside) {
    const x = Math.round((Math.random() - 0.5) * 22);
    return Math.random() < 0.25
      ? [12.8, -0.3]
      : [x, Math.random() < 0.5 ? -0.2 : 0.2 * CORRIDOR_HALF];
  }
  return Math.random() < 0.5
    ? [PARK.x, PARK.z - 2.6]
    : [Math.round((Math.random() - 0.5) * 50), PROMENADE_Z + 0.9];
}

// Mengajak satu karakter santai lain ngobrol. Mengembalikan pertemuan, atau null bila tidak ada yang bebas.
export function proposeChat(id: string, from: Vec2, now: number): Meet | null {
  const partners = [...available].filter((p) => p !== id && !meets.has(p));
  if (!partners.length || meets.has(id)) return null;
  const b = partners[Math.floor(Math.random() * partners.length)];
  const spot = meetingSpot(from);
  const meet: Meet = {
    key: `chat-${++counter}`,
    a: id,
    b,
    spot,
    zone: zoneAt(spot[0], spot[1]),
    until: now + 30000,
    startedAt: 0,
    arrived: new Set(),
  };
  meets.set(id, meet);
  meets.set(b, meet);
  return meet;
}

export function meetOf(id: string, now: number): Meet | undefined {
  const m = meets.get(id);
  if (m && now > m.until) {
    meets.delete(m.a);
    meets.delete(m.b);
    return undefined;
  }
  return m;
}

export function leaveMeet(id: string) {
  const m = meets.get(id);
  if (!m) return;
  meets.delete(m.a);
  meets.delete(m.b);
}

export function markArrived(m: Meet, id: string, now: number) {
  if (m.arrived.has(id)) return;
  m.arrived.add(id);
  if (m.arrived.size === 2) {
    m.startedAt = now;
    m.until = now + 9000 + Math.random() * 7000; // lama obrolan dihitung sejak keduanya tiba
  }
}

// Posisi masing-masing: berhadapan dengan jarak 1,1.
export function placeIn(m: Meet, id: string): { at: Vec2; face: number } {
  const left = id === m.a;
  const at: Vec2 = [m.spot[0] + (left ? -0.55 : 0.55), m.spot[1]];
  return { at, face: left ? Math.PI / 2 : -Math.PI / 2 };
}

const TURN_MS = 2600;

// Siapa yang sedang bicara dan kalimat ke berapa.
export function turnOf(
  m: Meet,
  now: number,
): { speaker: string; turn: number } | null {
  if (!m.startedAt) return null;
  const turn = Math.floor((now - m.startedAt) / TURN_MS);
  return { speaker: turn % 2 === 0 ? m.a : m.b, turn };
}
