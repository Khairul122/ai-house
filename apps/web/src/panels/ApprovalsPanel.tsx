import { ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { useFetch } from "../lib/hooks.ts";
import { useDivisionName, useOffice } from "../state/store.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";

interface Row {
  id: string;
  riskLevel: number;
  actionSummary: string;
  divisionId: string | null;
  taskTitle: string | null;
}

export function ApprovalsPanel() {
  const version = useOffice((s) => s.version);
  const { data, error, reload } = useFetch<Row[]>("/api/approvals", version);
  const nameOf = useDivisionName();

  return (
    <PanelShell title="Persetujuan" subtitle="Aksi berisiko berhenti di sini sampai Anda memutuskan.">
      {error && <ErrorNote>{error}</ErrorNote>}
      {data?.length === 0 && (
        <p className="text-sm text-ink-muted">Tidak ada yang menunggu. Saat divisi butuh izin, karakternya mengangkat tangan dan tanda ! muncul di atas kepalanya.</p>
      )}
      <div className="space-y-3">
        {data?.map((r) => (
          <ApprovalCard
            key={r.id}
            showOfficeLink
            onDecided={reload}
            a={{
              id: r.id,
              summary: r.actionSummary,
              riskLevel: r.riskLevel,
              divisionId: r.divisionId,
              divisionName: r.divisionId ? nameOf(r.divisionId) : undefined,
              taskTitle: r.taskTitle
            }}
          />
        ))}
      </div>
    </PanelShell>
  );
}
