import { useEffect, useSyncExternalStore } from "react";
import {
  PHASE_START,
  type Phase,
  type Weather,
  phaseOf,
  weatherFrom,
} from "../features/office/environment.ts";
import { whenHouse } from "./store.ts";

// Suasana kantor: jam (nyata atau simulasi), cuaca (nyata dari Open-Meteo atau pilihan), dan suara.
export interface EnvState {
  offsetMs: number; // selisih jam simulasi dengan jam nyata
  phaseOverride: Phase | null;
  weatherMode: "auto" | Weather;
  autoWeather: Weather;
  tempC: number | null;
  sound: boolean;
  tick: number; // naik tiap 30 detik agar tampilan jam ikut berganti
}

const PREF_KEY = "ai-house-env";

function loadPrefs(): Partial<EnvState> {
  try {
    return JSON.parse(
      localStorage.getItem(PREF_KEY) ?? "{}",
    ) as Partial<EnvState>;
  } catch {
    return {};
  }
}

const prefs = loadPrefs();
let state: EnvState = {
  offsetMs: 0,
  phaseOverride: null,
  weatherMode: prefs.weatherMode ?? "auto",
  autoWeather: "cerah",
  tempC: null,
  sound: prefs.sound ?? false,
  tick: 0,
};
const listeners = new Set<() => void>();

function set(patch: Partial<EnvState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
  try {
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ weatherMode: state.weatherMode, sound: state.sound }),
    );
  } catch {
    // penyimpanan peramban tidak tersedia: preferensi hanya berlaku sampai halaman ditutup
  }
}

export const env = {
  get: () => state,
  now: () => new Date(Date.now() + state.offsetMs),
  weather: (): Weather =>
    state.weatherMode === "auto" ? state.autoWeather : state.weatherMode,
  phase: (): Phase => phaseOf(env.now()),
  setPhase(p: Phase | null) {
    if (!p) return set({ phaseOverride: null, offsetMs: 0 });
    const target = new Date();
    const h = PHASE_START[p];
    target.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    set({ phaseOverride: p, offsetMs: target.getTime() - Date.now() });
  },
  setWeather: (weatherMode: EnvState["weatherMode"]) => set({ weatherMode }),
  setSound: (sound: boolean) => set({ sound }),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useEnv<T>(select: (s: EnvState) => T): T {
  return useSyncExternalStore(env.subscribe, () => select(state));
}

// Cuaca nyata di lokasi kantor (profil dari server) lewat Open-Meteo (gratis, tanpa kunci). Diperbarui tiap 15 menit.
async function fetchWeather() {
  try {
    const house = await whenHouse();
    const q = new URLSearchParams({
      latitude: String(house.latitude),
      longitude: String(house.longitude),
      current: "temperature_2m,weather_code",
      timezone: house.timezone,
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    const body = (await res.json()) as {
      current?: { temperature_2m: number; weather_code: number };
    };
    if (body.current)
      set({
        autoWeather: weatherFrom(
          body.current.weather_code,
          body.current.temperature_2m,
        ),
        tempC: Math.round(body.current.temperature_2m),
      });
  } catch {
    // tanpa internet: tetap memakai cuaca terakhir
  }
}

export function useEnvironmentClock() {
  useEffect(() => {
    void fetchWeather();
    const w = setInterval(fetchWeather, 15 * 60_000);
    const t = setInterval(() => set({ tick: state.tick + 1 }), 30_000);
    return () => {
      clearInterval(w);
      clearInterval(t);
    };
  }, []);
}
