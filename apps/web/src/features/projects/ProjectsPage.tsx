import React, { useEffect, useState } from "react";
import { fetchJson } from "../../lib/api.ts";
import { Plus } from "lucide-react";

interface Project {
  id: string;
  title: string;
  goal: string;
  status: string;
  createdAt: string;
}

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");

  const loadProjects = () => {
    fetchJson<Project[]>("/api/projects")
      .then(setProjects)
      .catch((err) => console.error("Failed to load projects", err));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !goal) return;

    fetchJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, goal })
    }).then(() => {
      setTitle("");
      setGoal("");
      loadProjects();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Daftar Proyek</h2>
        <p className="text-sm text-ink-muted">Kelola dan pantau seluruh proyek aktif.</p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="bg-surface border border-line p-4 rounded space-y-3">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-accent" /> Buat Proyek Baru
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Judul Proyek"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border border-line rounded px-3 py-1.5 text-sm bg-background text-ink focus:outline-accent"
          />
          <input
            type="text"
            placeholder="Tujuan / Deskripsi"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="border border-line rounded px-3 py-1.5 text-sm bg-background text-ink focus:outline-accent"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-accent/90"
        >
          Buat Proyek
        </button>
      </form>

      {/* Projects List */}
      <div className="bg-surface border border-line rounded divide-y divide-line">
        {projects.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-muted">Belum ada proyek. Buat proyek pertama Anda di atas.</div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-ink">{p.title}</h4>
                <p className="text-xs text-ink-muted">{p.goal}</p>
              </div>
              <span className="text-xs font-mono uppercase px-2 py-1 rounded bg-accent/10 text-accent font-semibold">
                {p.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
