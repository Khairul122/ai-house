// Denah kantor: gedung bertingkat, satu lantai per bidang. Tiap lantai punya dua baris ruangan
// mengapit koridor di sumbu X, ruang rapat di ujung timur, dan lift di ujung barat.
export const ROOM_W = 4.4;
export const ROOM_D = 4;
export const WALL_H = 1.7;
export const FLOOR_H = 3.2; // tinggi antar-lantai
export const CORRIDOR_HALF = 1.3;
export const FLOOR_HALF_X = 16.5;
export const FLOOR_HALF_Z = CORRIDOR_HALF + ROOM_D + 0.3;

export type Side = "n" | "s";

export interface RoomDef {
  id: string;
  x: number;
  z: number; // pusat ruangan
  w: number; // lebar ruangan, menyempit bila divisi lebih dari kapasitas lantai
  side: Side;
  level: number; // 0 = lantai dasar
  floor: string; // id lantai (bidang)
  meeting?: boolean; // ruang rapat lantai, bukan ruangan divisi
}

export interface FloorPlan {
  id: string;
  divisionIds: string[];
}

// Deretan ruangan divisi mengisi x dari -12.5 sampai 7.5; sisanya untuk ruang rapat.
const ROW_LEFT = -12.5;
const ROW_SPAN = 20;
const ROW_Z = CORRIDOR_HALF + ROOM_D / 2;
export const MEETING_W = 5.2;
export const MEETING_X = 10.6;

export const meetingIdOf = (floorId: string) => `rapat:${floorId}`;

// Denah dihitung dari daftar lantai: di tiap lantai separuh pertama divisi di deretan utara, sisanya
// di selatan, kolom sejajar. Ruang rapat lantai di deretan utara ujung timur.
export function buildRooms(floors: FloorPlan[]): RoomDef[] {
  return floors.flatMap((f, level) => {
    const ids = f.divisionIds;
    const cols = Math.max(1, Math.ceil(ids.length / 2));
    const spacing = Math.min(5, ROW_SPAN / cols);
    const w = Math.min(ROOM_W, spacing - 0.6);
    const xAt = (i: number) =>
      ROW_LEFT + ROW_SPAN / 2 + (i - (cols - 1) / 2) * spacing;
    const rooms: RoomDef[] = ids.map((id, i) => {
      const north = i < cols;
      const col = north ? i : i - cols;
      return {
        id,
        x: xAt(col),
        z: north ? -ROW_Z : ROW_Z,
        w,
        side: north ? "n" : "s",
        level,
        floor: f.id,
      };
    });
    rooms.push({
      id: meetingIdOf(f.id),
      x: MEETING_X,
      z: -ROW_Z,
      w: MEETING_W,
      side: "n",
      level,
      floor: f.id,
      meeting: true,
    });
    return rooms;
  });
}

let all: RoomDef[] = [];
let rooms: RoomDef[] = [];
let meetingRooms: RoomDef[] = [];
let roomKey = "";

// Dipanggil setiap daftar lantai/divisi dimuat ulang dari server.
export function setRoomOrder(floors: FloorPlan[]) {
  const key = floors.map((f) => `${f.id}:${f.divisionIds.join(",")}`).join("|");
  if (key === roomKey) return;
  roomKey = key;
  all = buildRooms(floors);
  rooms = all.filter((r) => !r.meeting);
  meetingRooms = all.filter((r) => r.meeting);
}

// Ruangan divisi saja (ruang rapat lewat getMeetingRooms).
export const getRooms = () => rooms;
export const allRooms = () => all;
export const getMeetingRooms = () => meetingRooms;
export const getLevels = () =>
  1 + all.reduce((n, r) => Math.max(n, r.level), 0);
export const roomById = (id: string) => all.find((r) => r.id === id);
export const levelOf = (zone: string) => roomById(zone)?.level ?? 0;

export type Vec2 = [number, number];

// Arah "ke koridor" dari dalam ruangan: utara menghadap +z, selatan -z.
export const toCorridor = (r: RoomDef) => (r.side === "n" ? 1 : -1);

export const seatOf = (r: RoomDef): Vec2 => [r.x, r.z - toCorridor(r) * 0.95];
export const deskOf = (r: RoomDef): Vec2 => [r.x, r.z - toCorridor(r) * 0.2];
export const standOf = (r: RoomDef): Vec2 => [
  r.x + 0.75,
  r.z - toCorridor(r) * 0.75,
];
export const insideOf = (r: RoomDef): Vec2 => [
  r.x,
  r.z + toCorridor(r) * (ROOM_D / 2 - 0.6),
];
export const laneOf = (r: RoomDef): Vec2 => [r.x, toCorridor(r) * -0.45];
// Jalur berpindah lantai: [x, z, lantai tujuan]. Titik dengan lantai menandai turun/naik lift.
export type Waypoint = [number, number] | [number, number, number];

// Lift di ujung barat tiap lantai: pintu di koridor, kabin di sisi utara. Pindah lantai terjadi di kabin.
export const LIFT = { door: [-14.6, -0.9] as Vec2, cab: [-14.6, -3.4] as Vec2 };

// Kursi ruang rapat: empat di tiap sisi meja panjang, menghadap meja.
export function meetingSeats(r: RoomDef): { at: Vec2; face: number }[] {
  return [-1.5, -0.5, 0.5, 1.5].flatMap((dx) => [
    { at: [r.x + dx, r.z - 0.95] as Vec2, face: 0 },
    { at: [r.x + dx, r.z + 0.95] as Vec2, face: Math.PI },
  ]);
}

// Titik bersama di ujung koridor lantai dasar.
export const SPOTS = {
  pantry: [14.6, -1.2] as Vec2,
  sofa: [14.6, 1.4] as Vec2,
  reception: [-14.4, 0.9] as Vec2,
};
export type SpotName = keyof typeof SPOTS;

export function randomInRoom(r: RoomDef): Vec2 {
  return [
    r.x + (Math.random() - 0.5) * (r.w - 1.6),
    r.z + (Math.random() - 0.5) * (ROOM_D - 1.6),
  ];
}

// ---------- Kampus di sekeliling gedung ----------
export const CAMPUS_HALF_X = 46;
export const CAMPUS_HALF_Z = 32;
export const PROMENADE_Z = 8.6; // jalan setapak di depan (selatan) gedung
export const PLAZA_Z = -12; // jalan setapak di depan deretan tempat ibadah
export const RING_X = 20.5; // jalan penghubung di kedua ujung gedung

// Pintu di ujung koridor. Barat lewat sisi selatan meja resepsionis, timur di antara pantry dan sofa.
export const EXITS = {
  west: { inner: [-16.4, -0.8] as Vec2, outer: [-RING_X, -0.8] as Vec2 },
  east: { inner: [16.4, 0.1] as Vec2, outer: [RING_X, 0.1] as Vec2 },
};

export const WORSHIP_Z = -20;
export const WORSHIP = [
  { id: "masjid", name: "Masjid", x: -35 },
  { id: "gereja-protestan", name: "Gereja Protestan", x: -21 },
  { id: "gereja-katolik", name: "Gereja Katolik", x: -7 },
  { id: "pura", name: "Pura", x: 7 },
  { id: "vihara", name: "Vihara", x: 21 },
  { id: "klenteng", name: "Klenteng", x: 35 },
] as const;

export const POOL = { x: -21, z: 19, w: 14, d: 8 };
export const LIBRARY = { x: 2, z: 20, w: 11, d: 6 };
export const PARK = { x: 25, z: 19 };

export type Act = "sleep" | "read" | "coffee" | "stretch" | "swim" | "relax";

export interface Leisure {
  key: string; // satu karakter per tempat
  at: Vec2; // untuk pose berbaring/berenang: posisi kaki, kepala mengarah ke belakang/depan
  pose: "sit" | "stand" | "lie" | "swim";
  act: Act;
  face: number; // arah hadap (radian, 0 = +z)
}

const loungerZ = POOL.z - POOL.d / 2 - 1.0;

// Tempat santai yang bisa didatangi karakter saat tidak ada tugas.
export const LEISURE: Leisure[] = [
  {
    key: "kopi-1",
    at: [14.7, -1.7],
    pose: "stand",
    act: "coffee",
    face: Math.PI / 2,
  },
  {
    key: "kopi-2",
    at: [14.7, -0.8],
    pose: "stand",
    act: "coffee",
    face: Math.PI / 2,
  },
  { key: "sofa", at: [15.45, 2.5], pose: "lie", act: "sleep", face: 0 },
  ...[-26, -23, -19, -16].map((x, i) => ({
    key: `kursi-kolam-${i}`,
    at: [x, loungerZ + 0.9] as Vec2,
    pose: "lie" as const,
    act: (i % 2 ? "relax" : "sleep") as Act,
    face: 0,
  })),
  ...[
    [-25.5, 18.2, 0.4],
    [-21, 20.4, 2.6],
    [-16.8, 17.6, -1.2],
  ].map(([x, z, f], i) => ({
    key: `renang-${i}`,
    at: [x, z] as Vec2,
    pose: "swim" as const,
    act: "swim" as const,
    face: f,
  })),
  ...[-3, 0, 3].map((dx, i) => ({
    key: `baca-${i}`,
    at: [LIBRARY.x + dx, LIBRARY.z + 0.9] as Vec2,
    pose: "sit" as const,
    act: "read" as const,
    face: Math.PI,
  })),
  {
    key: "rak-buku",
    at: [LIBRARY.x + 4.4, LIBRARY.z - 1.2],
    pose: "stand",
    act: "read",
    face: Math.PI,
  },
  {
    key: "taman-1",
    at: [PARK.x - 3.6, PARK.z],
    pose: "sit",
    act: "relax",
    face: Math.PI / 2,
  },
  {
    key: "taman-2",
    at: [PARK.x + 3.6, PARK.z],
    pose: "sit",
    act: "relax",
    face: -Math.PI / 2,
  },
  {
    key: "taman-3",
    at: [PARK.x, PARK.z + 3.6],
    pose: "sit",
    act: "relax",
    face: Math.PI,
  },
  {
    key: "senam-1",
    at: [PARK.x - 2.2, PARK.z + 6],
    pose: "stand",
    act: "stretch",
    face: Math.PI,
  },
  {
    key: "senam-2",
    at: [PARK.x + 2.2, PARK.z + 6],
    pose: "stand",
    act: "stretch",
    face: Math.PI,
  },
];

// Kalimat obrolan umum. Kalimat khas tiap divisi diambil dari `persona.smallTalk` di berkas divisinya.
export const GENERAL_TALK = [
  "Kopi lagi?",
  "Makan siang di mana?",
  "Haha, setuju.",
  "Capek juga ya.",
  "Nanti sore hujan katanya.",
  "Semangat!",
];

// ---------- Tempat ibadah: posisi jamaah di depan tiap bangunan ----------
export type WorshipStyle =
  | "salat"
  | "doa-duduk"
  | "doa-katolik"
  | "sembah"
  | "meditasi"
  | "dupa";

export interface WorshipSpot {
  key: string;
  at: Vec2;
  face: number;
  style: WorshipStyle;
  building: (typeof WORSHIP)[number]["id"];
}

// Arah kiblat dari Indonesia kira-kira barat-barat laut (~295°). Di kampus, -x = barat, -z = utara.
export const QIBLA = Math.atan2(-0.906, -0.423);
const bx = (id: (typeof WORSHIP)[number]["id"]) =>
  WORSHIP.find((w) => w.id === id)!.x;
const spot = (
  building: WorshipSpot["building"],
  style: WorshipStyle,
  face: number,
  list: Vec2[],
): WorshipSpot[] =>
  list.map(([x, z], i) => ({
    key: `${building}-${i}`,
    at: [bx(building) + x, WORSHIP_Z + z],
    face,
    style,
    building,
  }));

export const WORSHIP_SPOTS: Record<string, WorshipSpot[]> = {
  islam: spot("masjid", "salat", QIBLA, [
    [-1.6, 4.6],
    [0, 4.6],
    [1.6, 4.6],
    [-0.8, 5.9],
    [0.8, 5.9],
  ]),
  protestan: spot("gereja-protestan", "doa-duduk", Math.PI, [
    [-1, 5.3],
    [1, 5.3],
    [0, 6.5],
  ]),
  katolik: spot("gereja-katolik", "doa-katolik", Math.PI, [
    [-1, 6.1],
    [1, 6.1],
    [0, 7.2],
  ]),
  hindu: spot("pura", "sembah", Math.PI, [
    [-0.8, 5.4],
    [0.8, 5.4],
  ]),
  buddha: spot("vihara", "meditasi", Math.PI, [
    [-0.8, 5.2],
    [0.8, 5.2],
  ]),
  konghucu: spot("klenteng", "dupa", Math.PI, [
    [-0.6, 5.7],
    [0.6, 5.7],
  ]),
};
