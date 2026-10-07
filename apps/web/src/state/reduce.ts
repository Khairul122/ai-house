export type AgentStatus = "idle" | "working" | "waiting" | "failed" | "done";

export interface AgentState {
  status: AgentStatus;
  task: { id: string; title: string } | null;
  approval: { id: string; summary: string; riskLevel: number } | null;
  changedAt: number;
}

export interface Dispatch {
  taskId: string;
  to: string;
  title: string;
}

export type Connection = "connecting" | "live" | "offline";

export interface OfficeState {
  agents: Record<string, AgentState>;
  dispatches: Dispatch[];
  connection: Connection;
  version: number; // naik setiap ada event, dipakai panel untuk memuat ulang data
}

export interface SnapshotItem {
  divisionId: string;
  status: Exclude<AgentStatus, "done">;
  task: AgentState["task"];
  approval: AgentState["approval"];
}

export type OfficeEvent =
  | { type: "snapshot"; payload: SnapshotItem[] }
  | { type: "connection"; payload: Connection }
  | { type: "dispatch.delivered"; payload: { taskId: string } }
  | { type: "task.updated"; payload: { taskId: string; divisionId?: string; title?: string; status: string } }
  | { type: "task.dispatched"; payload: { taskId: string; to: string; title: string } }
  | { type: "approval.created"; payload: { id: string; divisionId: string; summary: string; riskLevel: number } }
  | { type: "approval.decided"; payload: { id: string; decision: "approved" | "rejected" } }
  | { type: string; payload: unknown };

export const initialState: OfficeState = { agents: {}, dispatches: [], connection: "connecting", version: 0 };

const blank = (now: number): AgentState => ({ status: "idle", task: null, approval: null, changedAt: now });

export function reduce(state: OfficeState, event: OfficeEvent, now = Date.now()): OfficeState {
  const patch = (id: string, change: Partial<AgentState>): OfficeState => {
    const prev = state.agents[id] ?? blank(now);
    return {
      ...state,
      version: state.version + 1,
      agents: { ...state.agents, [id]: { ...prev, ...change, changedAt: now } }
    };
  };

  switch (event.type) {
    case "snapshot": {
      const agents: Record<string, AgentState> = {};
      for (const s of event.payload as SnapshotItem[]) {
        agents[s.divisionId] = { status: s.status, task: s.task, approval: s.approval, changedAt: now };
      }
      return { ...state, agents, version: state.version + 1 };
    }
    case "connection":
      return { ...state, connection: event.payload as Connection };
    case "dispatch.delivered": {
      const { taskId } = event.payload as { taskId: string };
      return { ...state, dispatches: state.dispatches.filter((d) => d.taskId !== taskId) };
    }
    case "task.dispatched": {
      const d = event.payload as Dispatch;
      return { ...state, version: state.version + 1, dispatches: [...state.dispatches, d] };
    }
    case "task.updated": {
      const p = event.payload as { taskId: string; divisionId?: string; title?: string; status: string };
      if (!p.divisionId) return { ...state, version: state.version + 1 };
      const task = { id: p.taskId, title: p.title ?? "" };
      const prev = state.agents[p.divisionId];
      // Jangan timpa "menunggu izin" dengan update tugas berjalan yang sama.
      if (p.status === "running" && prev?.status === "waiting") return state;
      if (p.status === "running") return patch(p.divisionId, { status: "working", task });
      if (p.status === "done") return patch(p.divisionId, { status: "done", task, approval: null });
      if (p.status === "failed") return patch(p.divisionId, { status: "failed", task, approval: null });
      if (p.status === "cancelled") return patch(p.divisionId, { status: "idle", task: null, approval: null });
      return { ...state, version: state.version + 1 };
    }
    case "approval.created": {
      const p = event.payload as { id: string; divisionId: string; summary: string; riskLevel: number };
      return patch(p.divisionId, { status: "waiting", approval: { id: p.id, summary: p.summary, riskLevel: p.riskLevel } });
    }
    case "approval.decided": {
      const p = event.payload as { id: string; decision: "approved" | "rejected" };
      const entry = Object.entries(state.agents).find(([, a]) => a.approval?.id === p.id);
      if (!entry) return { ...state, version: state.version + 1 };
      return patch(entry[0], { status: p.decision === "approved" ? "working" : "idle", approval: null });
    }
    default:
      return { ...state, version: state.version + 1 };
  }
}

// Status yang ditampilkan karakter: "done" hanya dirayakan sebentar, lalu kembali santai.
export const CELEBRATE_MS = 2500;
export function visibleStatus(a: AgentState | undefined, now = Date.now()): AgentStatus {
  if (!a) return "idle";
  if (a.status === "done") return now - a.changedAt < CELEBRATE_MS ? "done" : "idle";
  return a.status;
}
