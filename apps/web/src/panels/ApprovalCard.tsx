import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorNote } from "../components/PanelShell.tsx";
import { postJson } from "../lib/hooks.ts";

export interface PendingApproval {
  id: string;
  summary: string;
  riskLevel: number;
  divisionId?: string | null;
  divisionName?: string;
  taskTitle?: string | null;
}

export function ApprovalCard({
  a,
  showOfficeLink,
  onDecided,
}: { a: PendingApproval; showOfficeLink?: boolean; onDecided?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "approved" | "rejected") => {
    setBusy(true);
    setError(null);
    postJson(`/api/approvals/${a.id}/decision`, { decision })
      .then(() => onDecided?.())
      .catch(() => setError("Keputusan tidak terkirim. Coba lagi."))
      .finally(() => setBusy(false));
  };

  return (
    <article className="approval">
      <p className="text-sm text-ink">
        {a.divisionName ? <strong>{a.divisionName}</strong> : "Sebuah divisi"}{" "}
        meminta izin menjalankan:
      </p>
      <code className="block font-mono text-sm bg-background border border-line rounded px-2 py-1.5 my-2 break-words">
        {a.summary}
      </code>
      <p className="text-xs text-ink-muted">
        Risiko level {a.riskLevel}
        {a.taskTitle ? ` · untuk tugas "${a.taskTitle}"` : ""}
      </p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          type="button"
          className="btn btn-ok"
          disabled={busy}
          onClick={() => decide("approved")}
        >
          Setujui
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => decide("rejected")}
        >
          Tolak
        </button>
        {showOfficeLink && a.divisionId && (
          <Link
            to={`/divisions/${a.divisionId}`}
            className="text-sm text-accent underline underline-offset-2 ml-auto"
          >
            Lihat di kantor
          </Link>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </article>
  );
}
