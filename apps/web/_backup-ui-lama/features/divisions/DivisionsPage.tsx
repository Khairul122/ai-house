import React, { useEffect, useState } from "react";
import { fetchJson } from "../../lib/api.ts";

interface Division {
  id: string;
  name: string;
  description: string;
  model: string;
  prompt: string;
  permission: {
    read: string;
    edit: string;
    bash: {
      allow: string[];
      ask: string[];
      deny: string[];
    };
  };
}

export const DivisionsPage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    fetchJson<Division[]>("/api/divisions").then(setDivisions);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pengaturan Divisi</h2>
        <p className="text-sm text-ink-muted">10 divisi aktif dan aturan izin masing-masing.</p>
      </div>

      <div className="space-y-4">
        {divisions.map((d) => (
          <div key={d.id} className="bg-surface border border-line rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-ink">{d.name} <span className="font-mono text-xs font-normal text-ink-muted">({d.id})</span></h3>
              <span className="font-mono text-xs bg-line/40 px-2 py-0.5 rounded text-ink">{d.model}</span>
            </div>
            <p className="text-sm text-ink-muted">{d.description}</p>
            <div className="bg-background border border-line rounded p-3 text-xs font-mono space-y-1">
              <div><span className="text-ok font-semibold">Bash Allow:</span> {d.permission.bash.allow.join(", ") || "-"}</div>
              <div><span className="text-warn font-semibold">Bash Ask (Level 3):</span> {d.permission.bash.ask.join(", ") || "-"}</div>
              <div><span className="text-danger font-semibold">Bash Deny (Level 4):</span> {d.permission.bash.deny.join(", ") || "-"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
