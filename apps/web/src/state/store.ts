import { useEffect, useSyncExternalStore } from "react";
import {
  type RoomDef,
  getRooms,
  setRoomOrder,
} from "../features/office/layout.ts";
import { fetchJson } from "../lib/api.ts";
import { playEventSound } from "../lib/sound.ts";
import { trackFlow } from "./flows.ts";
import { push, toastFor } from "./notify.ts";
import {
  type OfficeEvent,
  type OfficeState,
  type SnapshotItem,
  initialState,
  reduce,
} from "./reduce.ts";

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
  },
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
  floor?: string;
  publish?: boolean;
  order?: number;
  religion?: string;
  persona?: Persona;
  permission: {
    read: string;
    edit: string;
    bash: { allow: string[]; ask: string[]; deny: string[] };
  };
}

// Lantai gedung = bidang (Software, Content Creator, ...), dari bawah ke atas.
export interface Floor {
  id: string;
  name: string;
  description: string;
  level: number;
  leadId: string | null;
  divisionIds: string[];
}

let divisions: Division[] = [];
let floors: Floor[] = [];
const divisionListeners = new Set<() => void>();
const subscribeDivisions = (l: () => void) => {
  divisionListeners.add(l);
  return () => divisionListeners.delete(l);
};

export const getDivisions = () => divisions;
export const getFloors = () => floors;

export function useFloors(): Floor[] {
  return useSyncExternalStore(subscribeDivisions, () => floors);
}

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

// Ketua bidang divisi ini (koordinator di lantainya), atau koordinator utama.
export const leadFor = (divisionId: string | undefined): string | null => {
  const floor = divisions.find((d) => d.id === divisionId)?.floor;
  return (
    divisions.find((d) => d.floor === floor && d.role === "coordinator")?.id ??
    coordinatorId()
  );
};

export function useCoordinatorId(): string | null {
  return coordinatorId(useDivisions());
}

// Tugas perencanaan milik koordinator (utama atau ketua bidang): tidak bisa direvisi dan tidak dihitung sebagai pekerjaan.
export function useIsPlanTask(): (t: {
  divisionId: string;
  title: string;
}) => boolean {
  const list = useDivisions();
  const title = useHouse()?.planTaskTitle;
  return (t) =>
    !!title &&
    t.title === title &&
    list.find((d) => d.id === t.divisionId)?.role === "coordinator";
}

export const reloadDivisions = () =>
  Promise.all([
    fetchJson<Division[]>("/api/divisions"),
    fetchJson<Floor[]>("/api/floors"),
  ])
    .then(([d, f]) => {
      divisions = d;
      floors = f;
      setRoomOrder(f);
      for (const l of divisionListeners) l();
    })
    .catch(() => {});

// ---------- rapat bidang ----------

export interface Meeting {
  id: string;
  title: string;
  goal: string;
  status: string;
  floorId: string | null;
  createdAt: string;
}

let meetings: Meeting[] = [];
const meetingListeners = new Set<() => void>();

// Lantai yang sedang rapat: karakternya berkumpul di ruang rapat. Dibaca tiap frame oleh karakter.
export const meetingOn = (floorId: string | undefined) =>
  !!floorId &&
  meetings.some((m) => m.floorId === floorId && m.status === "in_progress");

export function useMeetings(): Meeting[] {
  return useSyncExternalStore(
    (l) => {
      meetingListeners.add(l);
      return () => meetingListeners.delete(l);
    },
    () => meetings,
  );
}

const loadMeetings = () =>
  fetchJson<Meeting[]>("/api/meetings")
    .then((m) => {
      meetings = m;
      for (const l of meetingListeners) l();
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
export const whenHouse = (): Promise<HouseProfile> =>
  house ? Promise.resolve(house) : new Promise((r) => houseWaiters.push(r));

export function useHouse(): HouseProfile | null {
  return useSyncExternalStore(
    (l) => {
      houseListeners.add(l);
      return () => houseListeners.delete(l);
    },
    () => house,
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
    loadMeetings();

    const es = new EventSource("/api/events");
    es.onopen = () => {
      office.send({ type: "connection", payload: "live" });
      loadSnapshot();
      loadMeetings();
      // berkas divisi bisa berubah selama server mati (divisi baru, persona, urutan)
      reloadDivisions();
      if (!house) loadHouse();
    };
    es.onerror = () => office.send({ type: "connection", payload: "offline" });
    es.onmessage = (m) => {
      try {
        const event = JSON.parse(m.data) as OfficeEvent;
        office.send(event);
        if (event.type === "project.updated") loadMeetings();
        playEventSound(event);
        trackFlow(event);
        const toast = toastFor(event, divisionName);
        if (toast) push(toast);
      } catch {
        // abaikan pesan yang bukan JSON
      }
    };
    return () => es.close();
  }, []);
}

const divisionName = (id: string | null | undefined) =>
  divisions.find((d) => d.id === id)?.name ?? id ?? "Sistem";

export function useDivisionName() {
  const list = useDivisions();
  return (id: string | null | undefined) =>
    list.find((d) => d.id === id)?.name ?? id ?? "Sistem";
}
