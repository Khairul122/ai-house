import { useSyncExternalStore } from "react";
import type { OfficeEvent } from "./reduce.ts";

// Notifikasi singkat dari event server. Persetujuan tetap tampil sampai diputuskan atau ditutup.
export type ToastTone = "info" | "ok" | "warn" | "danger";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  to?: string; // rute yang dibuka saat notifikasi diklik
  approvalId?: string;
  sticky?: boolean;
}

const MAX = 4;
const LIFETIME_MS = 6500;

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

export function dismiss(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function push(t: Toast) {
  dismiss(t.id);
  toasts = [t, ...toasts];
  // yang paling lama dan tidak menunggu keputusan dibuang lebih dulu
  while (toasts.length > MAX) {
    const victim =
      [...toasts].reverse().find((x) => !x.sticky) ?? toasts[toasts.length - 1];
    dismiss(victim.id);
  }
  if (!t.sticky)
    timers.set(
      t.id,
      setTimeout(() => dismiss(t.id), LIFETIME_MS),
    );
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}

// Menerjemahkan event server menjadi notifikasi. `nameOf` memberi nama divisi yang terbaca.
export function toastFor(
  event: OfficeEvent,
  nameOf: (id: string | undefined) => string,
): Toast | null {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const division = typeof p.divisionId === "string" ? p.divisionId : undefined;
  switch (event.type) {
    case "approval.created":
      return {
        id: `approval-${p.id}`,
        tone: "warn",
        title: `${nameOf(division)} meminta izin`,
        body: String(p.summary ?? ""),
        to: division ? `/divisions/${division}` : "/approvals",
        approvalId: String(p.id),
        sticky: true,
      };
    case "approval.decided":
      dismiss(`approval-${p.id}`);
      return null;
    case "task.updated":
      if (p.status === "done")
        return {
          id: `task-${p.taskId}`,
          tone: "ok",
          title: `${nameOf(division)} selesai`,
          body: String(p.title ?? ""),
          to: division ? `/divisions/${division}` : undefined,
        };
      if (p.status === "failed")
        return {
          id: `task-${p.taskId}`,
          tone: "danger",
          title: `${nameOf(division)} gagal`,
          body: String(p.title ?? ""),
          to: division ? `/divisions/${division}` : undefined,
        };
      return null;
    case "project.updated":
      if (p.status === "completed")
        return {
          id: `project-${p.id}`,
          tone: "ok",
          title: "Proyek selesai",
          body: String(p.title ?? ""),
          to: `/reports/${p.id}`,
        };
      if (p.status === "failed")
        return {
          id: `project-${p.id}`,
          tone: "danger",
          title: "Proyek berhenti",
          body: String(p.title ?? ""),
          to: `/projects/${p.id}`,
        };
      if (p.status === "plan_review")
        return {
          id: `project-${p.id}`,
          tone: "info",
          title: "Rencana siap ditinjau",
          body: String(p.title ?? ""),
          to: `/projects/${p.id}`,
          sticky: true,
        };
      return null;
    default:
      return null;
  }
}
