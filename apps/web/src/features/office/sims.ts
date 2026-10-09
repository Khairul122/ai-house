// Simulasi kehidupan kecil ala The Sims: kebutuhan tiap karakter turun-naik sesuai kegiatan,
// dan dari situ lahir emosi serta pilihan kegiatan santai. Disimpan di luar React (dibaca tiap frame).

export type Need = "energi" | "sosial" | "hiburan" | "spiritual";
export type Needs = Record<Need, number>; // 0..100
export type Emotion =
  | "senang"
  | "fokus"
  | "santai"
  | "lelah"
  | "bosan"
  | "kesepian"
  | "cemas"
  | "sedih"
  | "khusyuk";

export const NEED_LABEL: Record<Need, string> = {
  energi: "Energi",
  sosial: "Sosial",
  hiburan: "Hiburan",
  spiritual: "Spiritual",
};
export const EMOTION_LABEL: Record<Emotion, string> = {
  senang: "Senang",
  fokus: "Fokus",
  santai: "Santai",
  lelah: "Lelah",
  bosan: "Bosan",
  kesepian: "Kesepian",
  cemas: "Cemas",
  sedih: "Sedih",
  khusyuk: "Khusyuk",
};

// Kegiatan yang sedang dilakukan, untuk menghitung perubahan kebutuhan.
export type Doing =
  | "kerja"
  | "tidur"
  | "kopi"
  | "ngobrol"
  | "berenang"
  | "membaca"
  | "taman"
  | "ibadah"
  | "jalan"
  | "diam";

// Perubahan per menit. Positif mengisi, negatif menguras.
const RATE: Record<Doing, Partial<Needs>> = {
  kerja: { energi: -2.2, hiburan: -1.6, sosial: -0.8, spiritual: -0.3 },
  tidur: { energi: 14, sosial: -0.4, spiritual: -0.2 },
  kopi: { energi: 6, hiburan: 2, sosial: -0.4 },
  ngobrol: { sosial: 18, hiburan: 4, energi: -0.4 },
  berenang: { hiburan: 14, energi: -1.5, sosial: 1 },
  membaca: { hiburan: 9, spiritual: 1, energi: -0.3 },
  taman: { hiburan: 8, energi: 1, sosial: 1 },
  ibadah: { spiritual: 30, energi: 0.5, hiburan: 0.5 },
  jalan: { energi: -0.6, hiburan: 0.5, sosial: -0.6, spiritual: -0.3 },
  diam: { energi: -0.3, hiburan: -0.9, sosial: -0.8, spiritual: -0.3 },
};

export function stepNeeds(n: Needs, doing: Doing, minutes: number): Needs {
  const r = RATE[doing];
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return {
    energi: clamp(n.energi + (r.energi ?? 0) * minutes),
    sosial: clamp(n.sosial + (r.sosial ?? 0) * minutes),
    hiburan: clamp(n.hiburan + (r.hiburan ?? 0) * minutes),
    spiritual: clamp(n.spiritual + (r.spiritual ?? 0) * minutes),
  };
}

export function lowestNeed(n: Needs): Need {
  return (Object.keys(n) as Need[]).reduce((a, b) => (n[b] < n[a] ? b : a));
}

export function mood(n: Needs): number {
  return Math.round((n.energi + n.sosial + n.hiburan + n.spiritual) / 4);
}

// Emosi dari status kerja (bila ada) dan kebutuhan. Status kerja nyata selalu menang.
export function emotionOf(n: Needs, status: string, doing: Doing): Emotion {
  if (doing === "ibadah") return "khusyuk";
  if (status === "failed") return "sedih";
  if (status === "waiting") return "cemas";
  if (status === "done") return "senang";
  if (status === "working") return n.energi < 25 ? "lelah" : "fokus";
  if (n.energi < 20) return "lelah";
  if (n.sosial < 20) return "kesepian";
  if (n.hiburan < 20) return "bosan";
  if (mood(n) >= 70) return "senang";
  return "santai";
}

// ---------- penyimpanan bersama ----------

export interface SimState {
  needs: Needs;
  emotion: Emotion;
  activity: string; // kalimat untuk kartu karakter
}

const sims = new Map<string, SimState>();

export function simOf(id: string): SimState {
  let s = sims.get(id);
  if (!s) {
    const r = () => 55 + Math.random() * 35;
    s = {
      needs: { energi: r(), sosial: r(), hiburan: r(), spiritual: r() },
      emotion: "santai",
      activity: "Santai di ruangannya",
    };
    sims.set(id, s);
  }
  return s;
}
