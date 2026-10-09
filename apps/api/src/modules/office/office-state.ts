export type AgentStatus = "idle" | "working" | "waiting" | "failed";

export interface OfficeAgentState {
  divisionId: string;
  status: AgentStatus;
  task: { id: string; title: string } | null;
  approval: { id: string; summary: string; riskLevel: number } | null;
}

interface TaskRow {
  id: string;
  divisionId: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface PendingApprovalRow {
  id: string;
  divisionId: string | null;
  actionSummary: string;
  riskLevel: number;
}

// Status karakter per divisi: persetujuan tertunda > tugas berjalan > tugas terakhir gagal > santai.
export function deriveOfficeState(
  divisionIds: string[],
  taskRows: TaskRow[],
  pending: PendingApprovalRow[],
): OfficeAgentState[] {
  return divisionIds.map((divisionId) => {
    const own = taskRows
      .filter((t) => t.divisionId === divisionId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const approval = pending.find((a) => a.divisionId === divisionId);
    const running = own.find((t) => t.status === "running");
    const latest = own[0];

    const pick = running ?? latest;
    const task = pick ? { id: pick.id, title: pick.title } : null;

    if (approval) {
      return {
        divisionId,
        status: "waiting",
        task,
        approval: {
          id: approval.id,
          summary: approval.actionSummary,
          riskLevel: approval.riskLevel,
        },
      };
    }
    if (running) return { divisionId, status: "working", task, approval: null };
    if (latest?.status === "failed")
      return { divisionId, status: "failed", task, approval: null };
    return { divisionId, status: "idle", task: null, approval: null };
  });
}
