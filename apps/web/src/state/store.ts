import { useEffect, useSyncExternalStore } from "react";
import { getRooms, type RoomDef, setRoomOrder } from "../features/office/layout.ts";
import { fetchJson } from "../lib/api.ts";
import { playEventSound } from "../lib/sound.ts";
import { push, toastFor } from "./notify.ts";
import { initialState, reduce, type OfficeEvent, type OfficeState, type SnapshotItem } from "./reduce.ts";

let state: OfficeState = initialState;
const listeners = new Set<() => void>();

export const office = {
  get: () => state,
  send(event: OfficeEvent) {
    const next = reduce(state, event);
    if (next === state) return;
    state = next;
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  }
};

export function useOffice<T>(select: (s: OfficeState) => T): T {
  return useSyncExternalStore(office.subscribe, () => select(state));
}

export interface Persona {
  name?: string;
  short?: string;
  traits?: string[];
  shirt?: string;
  hair?: string;
  skin?: string;
  accent?: string;
  accessory?: string;
  signature?: string;
  smallTalk?: string[];
}

export interface Division {
  id: string;
  name: string;
  description: string;
  model: string;
  role?: "coordinator" | "member";
  order?: number;
  religion?: string;
  persona?: Persona;
  permission: { read: string; edit: string; bash: { allow: string[]; ask: string[]; deny: string[] } };
}

let divisions: Division[] = [];
const divisionListeners = new Set<() => void>();
const subscribeDivisions = (l: () => void) => {
  divisionListeners.add(l);
  return () => divisionListeners.delete(l);
};

export const getDivisions = () => divisions;

export function useDivisions(): Division[] {
  return useSyncExternalStore(subscribeDivisions, () => divisions);
}

// Ruangan kantor 3D, ikut berubah saat divisi ditambah, dihapus, atau diurutkan ulang.
export function useRooms(): RoomDef[] {
  return useSyncExternalStore(subscribeDivisions, getRooms);
}

// Divisi yang merencanakan dan membagi tugas (role: coordinator di berkas divisinya).
export const coordinatorId = (list: Division[] = divisions): string | null =>
  (list.find((d) => d.role === "coordinator") ?? list[0])?.id ?? null;

export function useCoordinatorId(): string | null {
  return coordinatorId(useDivisions());
}

// Tugas perencanaan milik koordinator (bukan hasil kerja divisi): tidak bisa direvisi dan tidak dihitung sebagai pekerjaan.
export function useIsPlanTask(): (t: { divisionId: string; title: string }) => boolean {
  const coordinator = useCoordinatorId();
  const title = useHouse()?.planTaskTitle;
  return (t) => !!title && t.title === title && t.divisionId === coordinator;
}

export const reloadDivisions = () =>
  fetchJson<Division[]>("/api/divisions")
    .then((d) => {
      divisions = d;
      setRoomOrder(d.map((x) => x.id));
      for (const l of divisionListeners) l();
    })
    .catch(() => {});

// Profil kantor dari server (nama dan lokasi cuaca), bukan nilai tetap di kode.
export interface HouseProfile {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  coordinatorId: string | null;
  planTaskTitle: string;
}

let house: HouseProfile | null = null;
const houseListeners = new Set<() => void>();
const houseWaiters: ((h: HouseProfile) => void)[] = [];

export const getHouse = () => house;

// Menunggu profil kantor termuat (dipakai mis. untuk cuaca nyata di lokasi kantor).
export const whenHouse = (): Promise<HouseProfile> => (house ? Promise.resolve(house) : new Promise((r) => houseWaiters.push(r)));

export function useHouse(): HouseProfile | null {
  return useSyncExternalStore(
    (l) => {
      houseListeners.add(l);
      return () => houseListeners.delete(l);
    },
    () => house
  );
}

const loadHouse = () =>
  fetchJson<HouseProfile>("/api/house")
    .then((h) => {
      house = h;
      for (const l of houseListeners) l();
      for (const w of houseWaiters.splice(0)) w(h);
    })
    .catch(() => {});

const loadSnapshot = () =>
  fetchJson<SnapshotItem[]>("/api/office")
    .then((payload) => office.send({ type: "snapshot", payload }))
    .catch(() => {});

// Satu koneksi SSE untuk seluruh aplikasi. EventSource menyambung ulang sendiri;
// setiap tersambung kembali, snapshot dimuat ulang agar event yang terlewat tidak hilang.
export function useLiveOffice() {
  useEffect(() => {
    reloadDivisions();
    loadHouse();

    const es = new EventSource("/api/events");
    es.onopen = () => {
      office.send({ type: "connection", payload: "live" });
      loadSnapshot();
      // berkas divisi bisa berubah selama server mati (divisi baru, persona, urutan)
      reloadDivisions();
      if (!house) loadHouse();
    };
    es.onerror = () => office.send({ type: "connection", payload: "offline" });
    es.onmessage = (m) => {
      try {
        const event = JSON.parse(m.data) as OfficeEvent;
        office.send(event);
        playEventSound(event);
        const toast = toastFor(event, divisionName);
        if (toast) push(toast);
      } catch {
        // abaikan pesan yang bukan JSON
      }
    };
    return () => es.close();
  }, []);
}

const divisionName = (id: string | null | undefined) => divisions.find((d) => d.id === id)?.name ?? id ?? "Sistem";

export function useDivisionName() {
  const list = useDivisions();
  return (id: string | null | undefined) => list.find((d) => d.id === id)?.name ?? id ?? "Sistem";
}
