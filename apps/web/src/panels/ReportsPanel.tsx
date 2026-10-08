import { Link, useParams } from "react-router-dom";
import { ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { lookOf } from "../features/office/looks.ts";
import { timeAgo, useFetch } from "../lib/hooks.ts";
import { useDivisionName, useOffice } from "../state/store.ts";
import { TASK_STATUS, WorkFiles } from "./ProjectPanel.tsx";
import { PROJECT_STATUS } from "./ProjectsPanel.tsx";

interface Project {
  id: string;
  title: string;
  goal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tokensUsed: number;
  workspacePath: string;
}

interface Report {
  project: Project;
  startedAt: string | null;
  endedAt: string | null;
  tasks: { id: string; divisionId: string; title: string; status: string; attempt: number; summary: string | null }[];
  actions: { id: string; taskId: string | null; summary: string; riskLevel: number; status: string; decidedBy: string | null; at: string | null }[];
  denied: { taskId: string; at: string; summary?: string; reason?: string }[];
}

function duration(from: string | null, to: string | null) {
  if (!from) return "belum mulai";
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min} menit` : `${Math.floor(min / 60)} jam ${min % 60} menit`;
}

const DECIDED: Record<string, string> = { approved: "dijalankan", rejected: "ditolak", expired: "kedaluwarsa", pending: "menunggu" };

// Daftar laporan: proyek yang sudah direncanakan, terbaru dulu.
export function ReportsPanel() {
  const version = useOffice((s) => s.version);
  const { data, error } = useFetch<Project[]>("/api/projects", version);
  const shown = data?.filter((p) => p.status !== "draft" && !p.title.startsWith("Demo:"));

  return (
    <PanelShell title="Laporan" subtitle="Hasil kerja tiap proyek. Divisi bekerja sendiri; Anda cukup membaca di sini.">
      {error && <ErrorNote>{error}</ErrorNote>}
      {shown?.length === 0 && <p className="text-sm text-ink-muted">Belum ada laporan. Buat proyek di Resepsionis, PM akan langsung merencanakan dan divisi mulai bekerja.</p>}
      <ul className="divide-y divide-line border-y border-line">
        {shown?.map((p) => (
          <li key={p.id}>
            <Link to={`/reports/${p.id}`} className="py-3 px-1 flex items-start justify-between gap-3 hover:bg-line/20">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{p.title}</p>
                <p className="text-xs text-ink-muted">Diperbarui {timeAgo(p.updatedAt)}</p>
              </div>
              <span className={`tag shrink-0 ${p.status === "completed" ? "tag-done" : p.status === "failed" ? "tag-failed" : p.status === "in_progress" ? "tag-working" : ""}`}>
                {PROJECT_STATUS[p.status] ?? p.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

// Satu laporan: ringkasan, kerja tiap divisi, aksi berisiko yang dijalankan atau diblokir, dan berkas hasil.
export function ReportPanel() {
  const { id = "" } = useParams();
  const version = useOffice((s) => s.version);
  const { data, error } = useFetch<Report>(`/api/projects/${id}/report`, version);
  const nameOf = useDivisionName();

  if (!data) return <PanelShell title="Laporan">{error ? <ErrorNote>{error}</ErrorNote> : <p className="text-sm text-ink-muted">Memuat laporan…</p>}</PanelShell>;

  const { project, tasks, actions, denied } = data;
  const done = tasks.filter((t) => t.status === "done").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const titleOf = (taskId: string | null) => tasks.find((t) => t.id === taskId)?.title ?? "";
  const auto = actions.filter((a) => a.decidedBy === "otomatis").length;

  return (
    <PanelShell title={project.title} subtitle={PROJECT_STATUS[project.status] ?? project.status}>
      <p className="text-sm text-ink-muted mb-3">{project.goal}</p>

      <dl className="report-stats">
        <div>
          <dt>Tugas selesai</dt>
          <dd>
            {done}/{tasks.length}
          </dd>
        </div>
        <div>
          <dt>Gagal</dt>
          <dd className={failed ? "text-danger" : ""}>{failed}</dd>
        </div>
        <div>
          <dt>Durasi</dt>
          <dd>{duration(data.startedAt, data.endedAt)}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>{project.tokensUsed.toLocaleString("id-ID")}</dd>
        </div>
      </dl>
      <p className="text-xs text-ink-muted mt-2 break-all">
        Folder: <span className="font-mono">{project.workspacePath}</span>
      </p>

      <h3 className="text-sm font-semibold text-ink mt-5 mb-1">Pekerjaan tiap divisi</h3>
      <ol className="divide-y divide-line border-y border-line">
        {tasks.map((t) => {
          const [label, tone] = TASK_STATUS[t.status] ?? [t.status, ""];
          const summary = t.summary?.trim();
          return (
            <li key={t.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink min-w-0">{t.title}</p>
                <span className={`tag ${tone} shrink-0`}>{label}</span>
              </div>
              <Link to={`/divisions/${t.divisionId}`} className="text-xs text-ink-muted hover:text-ink">
                {lookOf(t.divisionId).name} · {nameOf(t.divisionId)}
                {t.attempt > 1 && ` · percobaan ke-${t.attempt}`}
              </Link>
              {summary &&
                (summary.length > 260 ? (
                  <details className="mt-1.5">
                    <summary className="text-sm text-ink cursor-pointer">{summary.slice(0, 160).split("\n")[0]}…</summary>
                    <p className="text-sm text-ink whitespace-pre-wrap mt-1">{summary}</p>
                  </details>
                ) : (
                  <p className={`text-sm mt-1.5 whitespace-pre-wrap ${t.status === "failed" ? "text-danger" : "text-ink"}`}>{summary}</p>
                ))}
            </li>
          );
        })}
      </ol>

      <h3 className="text-sm font-semibold text-ink mt-5 mb-1">Aksi berisiko</h3>
      {actions.length === 0 && denied.length === 0 ? (
        <p className="text-sm text-ink-muted">Tidak ada aksi berisiko di proyek ini.</p>
      ) : (
        <>
          {auto > 0 && <p className="text-xs text-ink-muted mb-1">{auto} aksi dijalankan otomatis tanpa menunggu Anda.</p>}
          <ul className="space-y-2">
            {actions.map((a) => (
              <li key={a.id} className="text-sm">
                <code className="block font-mono text-xs bg-background border border-line rounded px-2 py-1 break-words">{a.summary}</code>
                <span className="text-xs text-ink-muted">
                  Level {a.riskLevel} · {DECIDED[a.status] ?? a.status}
                  {a.decidedBy ? ` oleh ${a.decidedBy === "otomatis" ? "mode otomatis" : a.decidedBy}` : ""}
                  {a.taskId ? ` · ${titleOf(a.taskId)}` : ""}
                </span>
              </li>
            ))}
            {denied.map((d) => (
              <li key={`${d.taskId}${d.at}`} className="text-sm">
                <code className="block font-mono text-xs bg-background border border-danger/40 rounded px-2 py-1 break-words">{d.summary}</code>
                <span className="text-xs text-danger">Diblokir otomatis (level 4): {d.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <WorkFiles projectId={project.id} refreshKey={version} />
    </PanelShell>
  );
}
