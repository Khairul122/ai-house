import React, { useEffect, useState } from "react";
import { fetchJson } from "../../lib/api.ts";
import { Check, X } from "lucide-react";

interface Approval {
  id: string;
  runId: string;
  riskLevel: number;
  actionType: string;
  actionSummary: string;
  expiresAt: string;
}

export const ApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const loadApprovals = () => {
    fetchJson<Approval[]>("/api/approvals")
      .then(setApprovals)
      .catch((err) => console.error("Failed to load approvals", err));
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleDecision = (id: string, decision: "approved" | "rejected") => {
    fetchJson(`/api/approvals/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision })
    }).then(() => loadApprovals());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Antrean Persetujuan</h2>
        <p className="text-sm text-ink-muted">Aksi berisiko (Level 3) yang membutuhkan izin manusia.</p>
      </div>

      <div className="space-y-3">
        {approvals.length === 0 ? (
          <div className="bg-surface border border-line p-8 rounded text-center text-sm text-ink-muted">
            Tidak ada aksi yang menunggu persetujuan saat ini.
          </div>
        ) : (
          approvals.map((a) => (
            <div key={a.id} className="bg-surface border border-line rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-warn/10 text-warn font-bold">
                    Level {a.riskLevel}
                  </span>
                  <span className="text-xs font-semibold text-ink uppercase">{a.actionType}</span>
                </div>
                <p className="text-sm text-ink font-medium">{a.actionSummary}</p>
                <p className="text-xs text-ink-muted font-mono">ID: {a.id}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecision(a.id, "approved")}
                  className="flex items-center gap-1 bg-ok text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-ok/90"
                >
                  <Check className="w-3.5 h-3.5" /> Setuju
                </button>
                <button
                  onClick={() => handleDecision(a.id, "rejected")}
                  className="flex items-center gap-1 bg-danger text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-danger/90"
                >
                  <X className="w-3.5 h-3.5" /> Tolak
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
