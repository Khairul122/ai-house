import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { lookOf, useCoordinatorLabel } from "../features/office/looks.ts";
import { postJson, useFetch } from "../lib/hooks.ts";
import { useDivisionName, useIsPlanTask, useOffice } from "../state/store.ts";
import { PROJECT_STATUS } from "./ProjectsPanel.tsx";
import { RevisionForm } from "./RevisionForm.tsx";

interface Task {
  id: string;
  divisionId: string;
  title: string;
  description: string;
  status: string;
  attempt: number;
  resultSummary: string | null;
  dependsOn: string[];
}

interface Detail {
  project: { id: string; title: string; goal: string; status: string; tokensUsed: number };
  tasks: Task[];
}

export const TASK_STATUS: Record<string, [string, string]> = {
  queued: ["Antre", ""],
  running: ["Berjalan", "tag-working"],
  done: ["Selesai", "tag-done"],
  failed: ["Gagal", "tag-failed"],
  cancelled: ["Dibatalkan", "tag-failed"]
};


interface WorkFile {
  path: string;
  size: number;
}

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const fileUrl = (projectId: string, p: string) => `/api/projects/${projectId}/files/${p.split("/").map(encodeURIComponent).join("/")}`;

// Berkas yang dibuat divisi di workspace proyek. Halaman HTML dibuka di tab baru (terisolasi).
export function WorkFiles({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const { data } = useFetch<WorkFile[]>(`/api/projects/${projectId}/files`, refreshKey);
  if (!data?.length) return null;
  const entry = data.find((f) => f.path === "index.html") ?? data.find((f) => f.path.endsWith("/index.html"));

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-ink mb-2">Hasil kerja</h3>
      {entry && (
        <a href={fileUrl(projectId, entry.path)} target="_blank" rel="noreferrer" className="btn btn-primary inline-block mb-3">
          Buka halaman hasil
        </a>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {data.map((f) => (
          <li key={f.path}>
            <a
              href={fileUrl(projectId, f.path)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 py-2 px-1 hover:bg-line/20"
            >
              <span className="font-mono text-xs text-ink truncate">{f.path}</span>
              <span className="text-xs text-ink-muted tabular-nums shrink-0">{kb(f.size)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskRow({ t, titleOf, onRetry, busy }: { t: Task; titleOf: (id: string) => string; onRetry: () => void; busy: boolean }) {
  const nameOf = useDivisionName();
  const isPlanTask = useIsPlanTask();
  const [label, tone] = TASK_STATUS[t.status] ?? [t.status, ""];
  const long = (t.resultSummary?.length ?? 0) > 180;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t.title}</p>
          <Link to={`/divisions/${t.divisionId}`} className="text-xs text-ink-muted inline-flex items-center gap-1.5 hover:text-ink">
            <span className="swatch" style={{ background: lookOf(t.divisionId).accent }} aria-hidden />
            {nameOf(t.divisionId)}
            {t.attempt > 1 && ` · percobaan ke-${t.attempt}`}
          </Link>
        </div>
        <span className={`tag ${tone} shrink-0`}>{label}</span>
      </div>
      {t.dependsOn.length > 0 && <p className="text-xs text-ink-muted mt-1">Setelah: {t.dependsOn.map(titleOf).join(", ")}</p>}
      {t.resultSummary &&
        (long ? (
          <details className="mt-1.5">
            <summary className="text-xs text-ink-muted cursor-pointer">Hasil kerja</summary>
            <p className="text-sm text-ink whitespace-pre-wrap mt-1">{t.resultSummary}</p>
          </details>
        ) : (
          <p className={`text-sm mt-1.5 whitespace-pre-wrap ${t.status === "failed" ? "text-danger" : "text-ink"}`}>{t.resultSummary}</p>
        ))}
      {(t.status === "failed" || t.status === "cancelled" || t.status === "done") && (
        <div className="task-actions">
          {(t.status === "failed" || t.status === "cancelled") && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry} disabled={busy}>
              Coba lagi
            </button>
          )}
          {(t.status === "done" || t.status === "failed") && !isPlanTask(t) && (
            <RevisionForm taskId={t.id} divisionId={t.divisionId} />
          )}
        </div>
      )}
    </li>
  );
}

export function ProjectPanel() {
  const { id = "" } = useParams();
  const version = useOffice((s) => s.version);
  const { data, error, reload } = useFetch<Detail>(`/api/projects/${id}`, version);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const isPlanTask = useIsPlanTask();
  const lead = useCoordinatorLabel();

  const act = (url: string) => {
    setBusy(true);
    setActionError(null);
    postJson(url, {})
      .then(reload)
      .catch((e: Error) => setActionError(e.message))
      .finally(() => {
        setBusy(false);
        setConfirmStop(false);
      });
  };

  if (!data) {
    return <PanelShell title="Proyek">{error ? <ErrorNote>{error}</ErrorNote> : <p className="text-sm text-ink-muted">Memuat proyek…</p>}</PanelShell>;
  }

  const { project, tasks } = data;
  const titleOf = (tid: string) => tasks.find((t) => t.id === tid)?.title ?? "tugas lain";
  const work = tasks.filter((t) => !isPlanTask(t));
  const planTask = tasks.find(isPlanTask);
  const doneCount = work.filter((t) => t.status === "done").length;
  const canStop = project.status === "planning" || project.status === "in_progress";
  // Saat draf, kegagalan rencana sudah tampil di kotak atas bersama tombol menyusun ulang.
  const shown = project.status === "draft" ? work : tasks;

  let callout: React.ReactNode = null;
  switch (project.status) {
    case "draft":
      callout = (
        <>
          {planTask?.status === "failed" && <p className="text-sm text-danger mb-2">{planTask.resultSummary}</p>}
          <p className="text-sm text-ink mb-3">{lead} belum menyusun rencana. {lead} akan memecah tujuan ini menjadi tugas untuk divisi lain, lalu menunggu persetujuan Anda.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(`/api/projects/${id}/plan`)}>
            {planTask ? `Minta ${lead} menyusun ulang` : `Minta ${lead} menyusun rencana`}
          </button>
        </>
      );
      break;
    case "planning":
      callout = <p className="text-sm text-ink">{lead} sedang menyusun rencana di ruangannya. Rencana muncul di sini begitu selesai.</p>;
      break;
    case "plan_review":
      callout = (
        <>
          <p className="text-sm text-ink mb-3">
            {lead} mengusulkan {work.length} tugas di bawah. Divisi baru mulai bekerja setelah Anda menyetujui rencana.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(`/api/projects/${id}/plan/approve`)}>
              Setujui rencana
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => act(`/api/projects/${id}/plan/reject`)}>
              Tolak, kembali ke draf
            </button>
          </div>
        </>
      );
      break;
    case "in_progress":
      callout = (
        <p className="text-sm text-ink">
          {doneCount} dari {work.length} tugas selesai. Tugas berikutnya mulai otomatis begitu prasyaratnya beres.
        </p>
      );
      break;
    case "completed":
      callout = <p className="text-sm text-ink">Semua {work.length} tugas selesai. Hasil tiap divisi ada di bawah.</p>;
      break;
    case "failed":
      callout = <p className="text-sm text-ink">Proyek berhenti karena ada tugas gagal. Baca sebabnya di bawah, lalu tekan "Coba lagi".</p>;
      break;
    case "cancelled":
      callout = <p className="text-sm text-ink">Proyek dihentikan. Tugas yang belum selesai bisa dicoba lagi satu per satu.</p>;
      break;
  }

  return (
    <PanelShell title={project.title} subtitle={PROJECT_STATUS[project.status] ?? project.status}>
      <p className="text-sm text-ink-muted mb-4">{project.goal}</p>

      <section className="border border-line rounded-md p-3 mb-4 bg-background">
        {callout}
        {canStop && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {confirmStop ? (
              <>
                <span className="text-sm text-ink">Hentikan semua run proyek ini?</span>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => act(`/api/projects/${id}/stop`)}>
                  Ya, hentikan
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmStop(false)}>
                  Batal
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmStop(true)}>
                Hentikan proyek
              </button>
            )}
          </div>
        )}
        {actionError && <ErrorNote>{actionError}</ErrorNote>}
      </section>

      {shown.length > 0 && (
        <ol className="divide-y divide-line border-y border-line">
          {shown.map((t) => (
            <TaskRow key={t.id} t={t} titleOf={titleOf} busy={busy} onRetry={() => act(`/api/tasks/${t.id}/retry`)} />
          ))}
        </ol>
      )}

      <WorkFiles projectId={project.id} refreshKey={version} />

      {project.tokensUsed > 0 && (
        <p className="text-xs text-ink-muted mt-3 tabular-nums">Token terpakai: {project.tokensUsed.toLocaleString("id-ID")}</p>
      )}
    </PanelShell>
  );
}
