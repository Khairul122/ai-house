import { useSyncExternalStore } from "react";

// Sudut kamera kantor 3D dan tur otomatis.
export type CameraView = "iso" | "top" | "front";

export interface CameraState {
  view: CameraView;
  tour: boolean;
  tourTarget: string | null; // ruangan yang sedang dikunjungi tur
  resetAt: number; // naik saat pengguna minta kamera kembali ke posisi awal
  floor: number | null; // lantai yang dilihat; lantai di atasnya disembunyikan. null = semua lantai
}

let state: CameraState = {
  view: "iso",
  tour: false,
  tourTarget: null,
  resetAt: 0,
  floor: 0, // mulai dari lantai dasar; tampilan "semua lantai" hanya menampilkan papan nama lantai
};
const listeners = new Set<() => void>();

function set(patch: Partial<CameraState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const camera = {
  get: () => state,
  setView: (view: CameraView) => set({ view, resetAt: Date.now() }),
  setTour: (tour: boolean) =>
    set({ tour, tourTarget: tour ? state.tourTarget : null }),
  setTourTarget: (tourTarget: string | null) => set({ tourTarget }),
  setFloor: (floor: number | null) => set({ floor }),
};

export function useCamera<T>(select: (s: CameraState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}
