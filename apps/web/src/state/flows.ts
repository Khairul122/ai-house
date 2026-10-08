import type { OfficeEvent } from "./reduce.ts";
import { coordinatorId } from "./store.ts";

// Aliran tugas yang digambar di kantor 3D: busur dari ruangan asal ke ruangan tujuan.
// "out" = koordinator mengirim tugas, "done" = divisi selesai, "fail" = divisi gagal, "ask" = minta izin.
export type FlowKind = "out" | "done" | "fail" | "ask";

export interface Flow {
  id: string;
  from: string;
  to: string;
  kind: FlowKind;
  at: number;
}

export const FLOW_MS = 2600;
const MAX = 8;
let flows: Flow[] = [];
let seq = 0;

export const activeFlows = (now = performance.now()) => {
  if (flows.length && now - flows[0].at > FLOW_MS)
    flows = flows.filter((f) => now - f.at <= FLOW_MS);
  return flows;
};

function add(
  from: string | null | undefined,
  to: string | null | undefined,
  kind: FlowKind,
) {
  if (!from || !to || from === to) return;
  flows = [
    ...flows,
    { id: `f${seq++}`, from, to, kind, at: performance.now() },
  ].slice(-MAX);
}

// Dipanggil untuk setiap event server (lihat store.ts).
export function trackFlow(event: OfficeEvent) {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const lead = coordinatorId();
  const division = typeof p.divisionId === "string" ? p.divisionId : undefined;
  if (event.type === "task.dispatched")
    add((p.from as string) ?? lead, p.to as string, "out");
  else if (event.type === "task.updated" && p.status === "done")
    add(division, lead, "done");
  else if (event.type === "task.updated" && p.status === "failed")
    add(division, lead, "fail");
  else if (event.type === "approval.created") add(division, lead, "ask");
}
