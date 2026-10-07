import React, { useState } from "react";
import { ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { postJson, timeAgo, useFetch } from "../lib/hooks.ts";
import { useOffice } from "../state/store.ts";

interface Project {
  id: string;
  title: string;
  goal: string;
  status: string;
  createdAt: string;
}

const STATUS: Record<string, string> = {
  draft: "Draf",
  planning: "Direncanakan PM",
  in_progress: "Berjalan",
  completed: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan"
};

export function ProjectsPanel() {
  const version = useOffice((s) => s.version);
  const { data, error, reload } = useFetch<Project[]>("/api/projects", version);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !goal.trim()) {
      setFormError("Judul dan tujuan wajib diisi.");
      return;
    }
    setBusy(true);
    setFormError(null);
    postJson("/api/projects", { title: title.trim(), goal: goal.trim() })
      .then(() => {
        setTitle("");
        setGoal("");
        reload();
      })
      .catch((err: Error) => setFormError(`Proyek gagal dibuat. ${err.message}`))
      .finally(() => setBusy(false));
  };

  return (
    <PanelShell title="Proyek" subtitle="Tulis permintaan Anda di resepsionis. PM yang akan membaginya.">
      <form onSubmit={create} className="space-y-2 mb-5" noValidate>
        <label className="field">
          <span>Judul</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama proyek" />
        </label>
        <label className="field">
          <span>Tujuan</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="Apa yang harus jadi, untuk siapa" />
        </label>
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Membuat…" : "Buat proyek"}
        </button>
      </form>

      {error && <ErrorNote>{error}</ErrorNote>}
      {data?.length === 0 && <p className="text-sm text-ink-muted">Belum ada proyek. Isi judul dan tujuan di atas untuk membuat yang pertama.</p>}
      <ul className="divide-y divide-line border-y border-line">
        {data?.map((p) => (
          <li key={p.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{p.title}</p>
              <p className="text-sm text-ink-muted">{p.goal}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-ink">{STATUS[p.status] ?? p.status}</p>
              <p className="text-xs text-ink-muted">{timeAgo(p.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
