import { useEffect, useSyncExternalStore } from "react";
import { fetchJson } from "../lib/api.ts";
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

export interface Division {
  id: string;
  name: string;
  description: string;
  model: string;
  permission: { read: string; edit: string; bash: { allow: string[]; ask: string[]; deny: string[] } };
}

let divisions: Division[] = [];
const divisionListeners = new Set<() => void>();

export function useDivisions(): Division[] {
  return useSyncExternalStore(
    (l) => {
      divisionListeners.add(l);
      return () => divisionListeners.delete(l);
    },
    () => divisions
  );
}

const loadSnapshot = () =>
  fetchJson<SnapshotItem[]>("/api/office")
    .then((payload) => office.send({ type: "snapshot", payload }))
    .catch(() => {});

// Satu koneksi SSE untuk seluruh aplikasi. EventSource menyambung ulang sendiri;
// setiap tersambung kembali, snapshot dimuat ulang agar event yang terlewat tidak hilang.
export function useLiveOffice() {
  useEffect(() => {
    fetchJson<Division[]>("/api/divisions")
      .then((d) => {
        divisions = d;
        for (const l of divisionListeners) l();
      })
      .catch(() => {});

    const es = new EventSource("/api/events");
    es.onopen = () => {
      office.send({ type: "connection", payload: "live" });
      loadSnapshot();
    };
    es.onerror = () => office.send({ type: "connection", payload: "offline" });
    es.onmessage = (m) => {
      try {
        office.send(JSON.parse(m.data) as OfficeEvent);
      } catch {
        // abaikan pesan yang bukan JSON
      }
    };
    return () => es.close();
  }, []);
}

export function useDivisionName() {
  const list = useDivisions();
  return (id: string | null | undefined) => list.find((d) => d.id === id)?.name ?? id ?? "Sistem";
}
