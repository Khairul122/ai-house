import { useEffect, useSyncExternalStore } from "react";
import { fetchJson } from "../lib/api.ts";

// Mode kerja House: "auto" = divisi bekerja tanpa minta izin (level 4 tetap ditolak), "ask" = menunggu keputusan.
export type Autonomy = "auto" | "ask";

let mode: Autonomy = "auto";
const listeners = new Set<() => void>();
const set = (m: Autonomy) => {
  mode = m;
  for (const l of listeners) l();
};

export function useAutonomy(): Autonomy {
  useEffect(() => {
    fetchJson<{ mode: Autonomy }>("/api/settings/autonomy")
      .then((r) => set(r.mode))
      .catch(() => {});
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}

export async function setAutonomy(next: Autonomy) {
  const r = await fetchJson<{ mode: Autonomy }>("/api/settings/autonomy", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: next }),
  });
  set(r.mode);
}
