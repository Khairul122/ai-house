import { useSyncExternalStore } from "react";

// Karakter yang sedang diklik di kantor 3D (kartu kecil muncul di atas kepalanya).
let focused: string | null = null;
const listeners = new Set<() => void>();

export function setFocus(id: string | null) {
  if (focused === id) return;
  focused = id;
  for (const l of listeners) l();
}

export function useFocus(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => focused,
  );
}
