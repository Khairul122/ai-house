// Waktu, cuaca, dan jadwal ibadah. Fungsi murni supaya mudah dites; jam memakai waktu lokal (WIB).

export type Phase = "pagi" | "siang" | "sore" | "malam";
export type Weather = "cerah" | "panas" | "dingin" | "hujan";
export type Religion =
  | "islam"
  | "protestan"
  | "katolik"
  | "hindu"
  | "buddha"
  | "konghucu";

export const PHASE_LABEL: Record<Phase, string> = {
  pagi: "Pagi",
  siang: "Siang",
  sore: "Sore",
  malam: "Malam",
};
export const WEATHER_LABEL: Record<Weather, string> = {
  cerah: "Cerah",
  panas: "Panas",
  dingin: "Dingin",
  hujan: "Hujan",
};
export const RELIGION_LABEL: Record<Religion, string> = {
  islam: "Islam",
  protestan: "Kristen Protestan",
  katolik: "Katolik",
  hindu: "Hindu",
  buddha: "Buddha",
  konghucu: "Konghucu",
};

// Jam awal tiap waktu, juga dipakai sebagai jam simulasi saat pengguna memilih waktu sendiri.
export const PHASE_START: Record<Phase, number> = {
  pagi: 5.75,
  siang: 11.8,
  sore: 15.1,
  malam: 17.9,
};

export function phaseOf(d: Date): Phase {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 11) return "pagi";
  if (h >= 11 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "sore";
  return "malam";
}

export interface Lighting {
  sky: string; // warna langit di cakrawala (bawah layar), juga warna kabut
  skyTop: string; // warna langit di atas layar (gradasi)
  sunColor: string;
  sun: number; // intensitas cahaya matahari/bulan
  sunPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  lamps: boolean; // lampu jalan dan lampu ruangan menyala
  fog: number; // 0 = tanpa kabut
}

// Langit bergradasi dan cahaya lembut, seperti foto maket arsitek di studio.
const BASE: Record<Phase, Lighting> = {
  pagi: {
    sky: "#FBE9DA",
    skyTop: "#BFD6F2",
    sunColor: "#FFE9CF",
    sun: 1.4,
    sunPos: [40, 30, 30],
    hemiSky: "#F4F1FF",
    hemiGround: "#C9D9B5",
    hemi: 1.15,
    lamps: false,
    fog: 0,
  },
  siang: {
    sky: "#EAF2FB",
    skyTop: "#9CC3EE",
    sunColor: "#FFFDF7",
    sun: 1.6,
    sunPos: [20, 60, 15],
    hemiSky: "#F5F8FF",
    hemiGround: "#C9D9B5",
    hemi: 1.25,
    lamps: false,
    fog: 0,
  },
  sore: {
    sky: "#FBD9BE",
    skyTop: "#C9A9D6",
    sunColor: "#FFC28E",
    sun: 1.25,
    sunPos: [-40, 26, 20],
    hemiSky: "#FFE9D8",
    hemiGround: "#BFC9A6",
    hemi: 1.0,
    lamps: false,
    fog: 0,
  },
  malam: {
    sky: "#2B3456",
    skyTop: "#0E1326",
    sunColor: "#AFC0EA",
    sun: 0.38,
    sunPos: [-20, 40, -30],
    hemiSky: "#46557F",
    hemiGround: "#262B24",
    hemi: 0.5,
    lamps: true,
    fog: 0,
  },
};

export function lightingFor(phase: Phase, weather: Weather): Lighting {
  const l = { ...BASE[phase] };
  if (weather === "hujan") {
    l.sky = phase === "malam" ? "#1B2130" : "#B9C2CB";
    l.skyTop = phase === "malam" ? "#0D1018" : "#7F8B97";
    l.sunColor = "#C9D0D6";
    l.sun *= 0.45;
    l.hemi *= 0.8;
    l.lamps = true;
    l.fog = 0.012;
  } else if (weather === "dingin") {
    l.sky = phase === "malam" ? "#1F2838" : "#E3EAF0";
    l.skyTop = phase === "malam" ? "#0E1422" : "#AFC2D3";
    l.sunColor = "#DCE6F0";
    l.sun *= 0.75;
    l.fog = 0.008;
  } else if (weather === "panas" && phase !== "malam") {
    l.sky = "#FFF1DC";
    l.skyTop = "#86BDF0";
    l.sunColor = "#FFE6B0";
    l.sun *= 1.15;
  }
  return l;
}

// Kode cuaca WMO (Open-Meteo) + suhu -> cuaca kantor.
export function weatherFrom(code: number, tempC: number): Weather {
  const rain =
    (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  if (rain) return "hujan";
  if (tempC >= 29) return "panas";
  if (tempC <= 21) return "dingin";
  return "cerah";
}

// ---------- jadwal ibadah ----------

const at = (h: number, m: number) => h * 60 + m;
interface Slot {
  start: number; // menit sejak tengah malam
  minutes: number;
  days?: number[]; // 0 = Minggu; kosong = setiap hari
}

// Perkiraan waktu untuk Bandung (WIB). Waktu salat bergeser beberapa menit sepanjang tahun.
const SCHEDULE: Record<Religion, Slot[]> = {
  islam: [at(4, 35), at(11, 55), at(15, 15), at(17, 55), at(19, 5)].map(
    (start) => ({ start, minutes: 15 }),
  ),
  protestan: [{ start: at(7, 30), minutes: 90, days: [0] }],
  katolik: [{ start: at(7, 0), minutes: 90, days: [0] }],
  hindu: [at(6, 0), at(12, 0), at(18, 0)].map((start) => ({
    start,
    minutes: 15,
  })), // Tri Sandhya
  buddha: [at(5, 30), at(17, 30)].map((start) => ({ start, minutes: 20 })), // puja pagi dan sore
  konghucu: [at(6, 30), at(17, 0)].map((start) => ({ start, minutes: 10 })),
};

// Bila sekarang waktu ibadah, kembalikan kapan selesainya (ms); bila bukan, null.
export function worshipUntil(
  religion: Religion | undefined,
  d: Date,
): number | null {
  if (!religion) return null;
  const minute = d.getHours() * 60 + d.getMinutes();
  for (const slot of SCHEDULE[religion]) {
    if (slot.days && !slot.days.includes(d.getDay())) continue;
    if (minute >= slot.start && minute < slot.start + slot.minutes) {
      const end = new Date(d);
      end.setHours(0, slot.start + slot.minutes, 0, 0);
      return end.getTime();
    }
  }
  return null;
}
