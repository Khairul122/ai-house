import {
  getDivisions,
  useCoordinatorId,
  useDivisions,
} from "../../state/store.ts";

export type Accessory =
  | "hardhat"
  | "glasses"
  | "hood"
  | "beret"
  | "headphones"
  | "tie"
  | "cap"
  | "bun"
  | "visor"
  | "scarf";

export interface Look {
  name: string; // nama karakter
  traits: string[]; // sifat, tampil di kartu karakter
  short: string; // nama di papan pintu
  shirt: string;
  hair: string;
  skin: string;
  accent: string; // satu warna khas divisi, hanya di aksesori dan papan pintu
  accessory: Accessory;
}

const ACCESSORIES: Accessory[] = [
  "hardhat",
  "glasses",
  "hood",
  "beret",
  "headphones",
  "tie",
  "cap",
  "bun",
  "visor",
  "scarf",
];
export type Signature =
  | "board"
  | "monitor"
  | "easel"
  | "server"
  | "checklist"
  | "screens"
  | "chart"
  | "camera"
  | "books"
  | "rack"
  | "mic"
  | "typewriter"
  | "phone"
  | "poster";
// Properti yang boleh dipilih otomatis untuk divisi tanpa persona (urutan lama dipertahankan agar tampilan tidak berubah).
const AUTO_SIGNATURES: Signature[] = [
  "board",
  "monitor",
  "easel",
  "server",
  "checklist",
  "screens",
  "chart",
  "camera",
  "books",
  "rack",
];
const SIGNATURES: Signature[] = [
  ...AUTO_SIGNATURES,
  "mic",
  "typewriter",
  "phone",
  "poster",
];
const SHIRTS = [
  "#3F4A5A",
  "#4A5A3F",
  "#5B4A3A",
  "#6B7B83",
  "#2E2F33",
  "#7A5C46",
  "#C9A27A",
  "#556B5E",
  "#45505C",
  "#EADFCB",
];
const HAIRS = [
  "#1C1A17",
  "#2B1E16",
  "#3A2A1C",
  "#4A3826",
  "#5A3A22",
  "#7A3B1E",
  "#121212",
  "#8C8C88",
];
const SKINS = [
  "#F2D0B0",
  "#F0C9A4",
  "#EBC7A2",
  "#E8BE98",
  "#E2B48C",
  "#D6A47C",
  "#C98E64",
  "#C48A60",
  "#B57C55",
  "#9C6B48",
];
const ACCENTS = [
  "#B4410F",
  "#5B7F3A",
  "#A8452E",
  "#D49A1F",
  "#2F6F7A",
  "#4F5D75",
  "#3D6B8C",
  "#B85C38",
  "#6B5B95",
  "#7A8B3F",
];

// Hash FNV-1a: divisi tanpa persona tetap mendapat tampilan yang sama setiap kali dimuat.
function hash(text: string, salt: string): number {
  let h = 2166136261;
  for (const ch of `${salt}:${text}`)
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
const pick = <T>(list: readonly T[], id: string, salt: string): T =>
  list[hash(id, salt) % list.length];
const oneOf = <T extends string>(
  list: readonly T[],
  v: string | undefined,
): T | undefined => (list.includes(v as T) ? (v as T) : undefined);

export interface FullLook extends Look {
  signature: Signature;
  smallTalk: string[];
}

const cache = new Map<string, { src: unknown; look: FullLook }>();

// Tampilan karakter dari `persona` di berkas divisi; bagian yang kosong diisi otomatis dari id.
export function lookOf(id: string): FullLook {
  const division = getDivisions().find((d) => d.id === id);
  const hit = cache.get(id);
  if (hit && hit.src === division) return hit.look;
  const p = division?.persona ?? {};
  const look: FullLook = {
    name: p.name || division?.name || id,
    traits: p.traits ?? [],
    short: p.short || (division?.name ?? id).split(/[\s&-]+/)[0],
    shirt: p.shirt || pick(SHIRTS, id, "shirt"),
    hair: p.hair || pick(HAIRS, id, "hair"),
    skin: p.skin || pick(SKINS, id, "skin"),
    accent: p.accent || pick(ACCENTS, id, "accent"),
    accessory:
      oneOf(ACCESSORIES, p.accessory) ?? pick(ACCESSORIES, id, "accessory"),
    signature:
      oneOf(SIGNATURES, p.signature) ?? pick(AUTO_SIGNATURES, id, "signature"),
    smallTalk: p.smallTalk ?? [],
  };
  cache.set(id, { src: division, look });
  return look;
}

// Versi hook: komponen ikut digambar ulang saat persona divisi berubah di server.
export function useLook(id: string): FullLook {
  useDivisions();
  return lookOf(id);
}

// Nama pendek divisi koordinator untuk teks panel (mis. "PM").
export function useCoordinatorLabel(): string {
  const id = useCoordinatorId();
  return id ? lookOf(id).short : "Koordinator";
}

// Warna pastel untuk ruangan dan benda kampus (gaya maket arsitek). Dipakai bergantian sesuai urutan ruangan.
export const TONES = [
  "#9DBEF2",
  "#F5A3A0",
  "#F7D47C",
  "#97D3B0",
  "#C4B5EE",
  "#F6B98A",
] as const;
export const toneAt = (i: number) =>
  TONES[((i % TONES.length) + TONES.length) % TONES.length];

// Warna dicampur putih (0 = asli, 1 = putih), untuk lantai dan karpet yang lembut.
export function tint(hex: string, white: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * white);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}

// Palet material: putih hangat, kayu ek terang, kaca kebiruan.
export const MAT = {
  concrete: "#F3EFE9",
  corridor: "#E8D9C4",
  wood: "#E6CBA6",
  woodDark: "#B8916A",
  wall: "#FBFAF8",
  wallTop: "#EDE9E3",
  glass: "#D6ECF5",
  metal: "#6B7079",
  screenOff: "#2A2D34",
  plant: "#5DAA6F",
  pot: "#F4EEE6",
  // status (hanya tiga warna yang punya arti)
  working: "#D7E6F2",
  waiting: "#E0A030",
  failed: "#C0392B",
  done: "#3E9B5F",
};
