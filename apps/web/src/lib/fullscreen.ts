import { useEffect, useState } from "react";

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

export function useIsFullscreen(): boolean {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return full;
}

// Fokus sedang di kolom isian: pintasan satu huruf tidak boleh ikut terpicu.
export const isTyping = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement | null)?.closest(
    "input, textarea, select, [contenteditable]",
  );
