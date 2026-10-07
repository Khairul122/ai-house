import React, { useEffect, useState } from "react";
import { fetchJson } from "../../lib/api.ts";

interface AuditItem {
  id: string;
  actor: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  detailJson: string;
  occurredAt: string;
}

export const ActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditItem[]>([]);

  useEffect(() => {
    fetchJson<AuditItem[]>("/api/audit")
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Log Aktivitas</h2>
        <p className="text-sm text-ink-muted">Riwayat jejak audit aksi dan kejadian sistem.</p>
      </div>

      <div className="bg-surface border border-line rounded overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-muted font-mono">Belum ada log aktivitas tercatat.</div>
        ) : (
          <div className="divide-y divide-line font-mono text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-3 flex items-start justify-between gap-4">
                <div>
                  <span className="font-semibold text-accent">{log.actor}</span>{" "}
                  <span className="text-ink">{log.eventType}</span> on{" "}
                  <span className="text-ink-muted">{log.subjectType}:{log.subjectId}</span>
                </div>
                <div className="text-ink-muted whitespace-nowrap">{new Date(log.occurredAt).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
