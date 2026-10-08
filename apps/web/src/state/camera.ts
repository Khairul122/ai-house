import { useSyncExternalStore } from "react";

// Sudut kamera kantor 3D dan tur otomatis.
export type CameraView = "iso" | "top" | "front";

export interface CameraState {
  view: CameraView;
  tour: boolean;
  tourTarget: string | null; // ruangan yang sedang dikunjungi tur
  resetAt: number; // naik saat pengguna minta kamera kembali ke posisi awal
}

let state: CameraState = {
  view: "iso",
  tour: false,
  tourTarget: null,
  resetAt: 0,
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
