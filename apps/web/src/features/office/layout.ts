// Denah kantor: dua baris ruangan mengapit koridor yang membentang di sumbu X.
export const ROOM_W = 4.4;
export const ROOM_D = 4;
export const WALL_H = 1.7;
export const CORRIDOR_HALF = 1.3;
export const FLOOR_HALF_X = 16.5;
export const FLOOR_HALF_Z = CORRIDOR_HALF + ROOM_D + 0.3;

export type Side = "n" | "s";

export interface RoomDef {
  id: string;
  x: number;
  z: number; // pusat ruangan
  side: Side;
}

const XS = [-10, -5, 0, 5, 10];
const NORTH = ["content-creator", "ui-ux-design", "pm", "software-development", "research-content"];
const SOUTH = ["data-analyst", "qa-testing", "devops", "infrastructure-network", "cybersecurity"];
const ROW_Z = CORRIDOR_HALF + ROOM_D / 2;

export const ROOMS: RoomDef[] = [
  ...NORTH.map((id, i) => ({ id, x: XS[i], z: -ROW_Z, side: "n" as const })),
  ...SOUTH.map((id, i) => ({ id, x: XS[i], z: ROW_Z, side: "s" as const }))
];

export const roomById = (id: string) => ROOMS.find((r) => r.id === id);

export type Vec2 = [number, number];

// Arah "ke koridor" dari dalam ruangan: utara menghadap +z, selatan -z.
export const toCorridor = (r: RoomDef) => (r.side === "n" ? 1 : -1);

export const seatOf = (r: RoomDef): Vec2 => [r.x, r.z - toCorridor(r) * 0.95];
export const deskOf = (r: RoomDef): Vec2 => [r.x, r.z - toCorridor(r) * 0.2];
export const standOf = (r: RoomDef): Vec2 => [r.x + 0.75, r.z - toCorridor(r) * 0.75];
export const insideOf = (r: RoomDef): Vec2 => [r.x, r.z + toCorridor(r) * (ROOM_D / 2 - 0.6)];
export const laneOf = (r: RoomDef): Vec2 => [r.x, toCorridor(r) * -0.45];

// Titik bersama di ujung koridor.
export const SPOTS = {
  pantry: [14.6, -1.2] as Vec2,
  sofa: [14.6, 1.4] as Vec2,
  reception: [-14.4, 0.9] as Vec2
};
export type SpotName = keyof typeof SPOTS;

export function randomInRoom(r: RoomDef): Vec2 {
  return [r.x + (Math.random() - 0.5) * (ROOM_W - 1.6), r.z + (Math.random() - 0.5) * (ROOM_D - 1.6)];
}
