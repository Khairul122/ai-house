import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "./api.ts";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Memuat JSON dan memuat ulang setiap `refreshKey` berubah (mis. versi event kantor).
export function useFetch<T>(url: string, refreshKey: unknown = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchJson<T>(url)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() =>
        setError(
          "Tidak bisa memuat data dari server. Pastikan backend berjalan di port 3000.",
        ),
      );
  }, [url]);

  useEffect(load, [load, refreshKey]);
  return { data, error, reload: load };
}

export const postJson = <T>(url: string, body: unknown) =>
  fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
