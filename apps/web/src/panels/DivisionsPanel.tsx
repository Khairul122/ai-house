import { Link, useParams } from "react-router-dom";
import { ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { timeAgo, useFetch } from "../lib/hooks.ts";
import { lookOf } from "../features/office/looks.ts";
import type { AgentState, AgentStatus } from "../state/reduce.ts";
import { useDivisions, useOffice } from "../state/store.ts";
import { useAgentStatus } from "../state/useAgentStatus.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";
import { CharacterCard, ReligionPicker } from "./CharacterCard.tsx";
import { ModelPicker } from "./ModelPicker.tsx";
import { TASK_STATUS } from "./ProjectPanel.tsx";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Santai",
  working: "Bekerja",
  waiting: "Menunggu izin",
  failed: "Gagal",
  done: "Selesai"
};

function statusLine(status: AgentStatus, agent: AgentState | undefined) {
  const task = agent?.task?.title;
  switch (status) {
    case "working":
      return `Mengerjakan "${task}".`;
    case "waiting":
      return "Berhenti dan menunggu keputusan Anda sebelum lanjut.";
    case "failed":
      return `Tugas terakhir gagal: "${task}".`;
    case "done":
      return `Baru saja menyelesaikan "${task}".`;
    default:
      return "Tidak ada tugas. Sesekali jalan ke pantry.";
  }
}

function StatusTag({ status }: { status: AgentStatus }) {
  return <span className={`tag tag-${status}`}>{STATUS_LABEL[status]}</span>;
}

function Row({ id, name }: { id: string; name: string }) {
  const { status } = useAgentStatus(id);
  return (
    <li>
      <Link to={`/divisions/${id}`} className="row-link">
        <span className="swatch" style={{ background: lookOf(id).accent }} aria-hidden />
        <span className="flex-1 text-sm text-ink">{name}</span>
        <StatusTag status={status} />
      </Link>
    </li>
  );
}

export function DivisionsPanel() {
  const divisions = useDivisions();
  return (
    <PanelShell title="Divisi" subtitle="Pilih divisi untuk mendekat ke ruangannya.">
      <ul className="divide-y divide-line border-y border-line">
        {divisions.map((d) => (
          <Row key={d.id} id={d.id} name={d.name} />
        ))}
      </ul>
    </PanelShell>
  );
}

function Rules({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  return (
    <div>
      <dt className={`text-xs font-semibold ${tone}`}>{label}</dt>
      <dd className="font-mono text-xs text-ink mt-0.5">{items.length ? items.join(", ") : "tidak ada"}</dd>
    </div>
  );
}

interface WorkItem {
  id: string;
  title: string;
  description: string;
  status: string;
  attempt: number;
  resultSummary: string | null;
  updatedAt: string;
  projectId: string;
  projectTitle: string;
}

function WorkRow({ w }: { w: WorkItem }) {
  const [label, tone] = TASK_STATUS[w.status] ?? [w.status, ""];
  const summary = w.resultSummary?.trim();
  return (
    <li className={`py-3 ${w.status === "running" ? "bg-accent/5 -mx-2 px-2 rounded" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink min-w-0">{w.title}</p>
        <span className={`tag ${tone} shrink-0`}>{label}</span>
      </div>
      <p className="text-xs text-ink-muted mt-0.5">
        <Link to={`/projects/${w.projectId}`} className="underline underline-offset-2 hover:text-ink">
          {w.projectTitle}
        </Link>
        {" · "}
        {timeAgo(w.updatedAt)}
        {w.attempt > 1 && ` · percobaan ke-${w.attempt}`}
      </p>
      {w.status === "running" && <p className="text-sm text-ink-muted mt-1.5">{w.description}</p>}
      {summary &&
        (summary.length > 220 ? (
          <details className="mt-1.5">
            <summary className="text-sm text-ink cursor-pointer">{summary.slice(0, 140).split("\n")[0]}…</summary>
            <p className="text-sm text-ink whitespace-pre-wrap mt-1">{summary}</p>
          </details>
        ) : (
          <p className={`text-sm mt-1.5 whitespace-pre-wrap ${w.status === "failed" ? "text-danger" : "text-ink"}`}>{summary}</p>
        ))}
      {w.status === "done" && (
        <Link to={`/projects/${w.projectId}`} className="text-xs text-accent underline underline-offset-2 mt-1.5 inline-block">
          Lihat berkas hasil
        </Link>
      )}
    </li>
  );
}

// Apa yang sedang dan pernah dikerjakan divisi ini, beserta hasilnya.
function DivisionWork({ id }: { id: string }) {
  const version = useOffice((s) => s.version);
  const { data, error } = useFetch<WorkItem[]>(`/api/divisions/${id}/tasks`, version);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <p className="text-sm text-ink-muted">Memuat pekerjaan…</p>;
  if (!data.length) {
    return <p className="text-sm text-ink-muted">Belum ada tugas. Tugas muncul di sini setelah PM membagi rencana proyek ke divisi ini.</p>;
  }
  const done = data.filter((w) => w.status === "done").length;
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink mb-1">Pekerjaan</h3>
      <p className="text-xs text-ink-muted mb-1">
        {data.length} tugas terakhir, {done} selesai.
      </p>
      <ol className="divide-y divide-line border-y border-line">
        {data.map((w) => (
          <WorkRow key={w.id} w={w} />
        ))}
      </ol>
    </section>
  );
}

export function DivisionPanel() {
  const { id = "" } = useParams();
  const division = useDivisions().find((d) => d.id === id);
  const { agent, status } = useAgentStatus(id);

  return (
    <PanelShell title={lookOf(id).name} subtitle={<StatusTag status={status} />}>
      <CharacterCard id={id} divisionName={division?.name ?? id} religion={division?.religion} />
      <p className="text-sm text-ink my-4">{statusLine(status, agent)}</p>

      {agent?.approval && (
        <div className="mb-5">
          <ApprovalCard a={{ ...agent.approval, divisionName: division?.name, taskTitle: agent.task?.title }} />
        </div>
      )}

      <DivisionWork id={id} />

      {division ? (
        <details className="mt-5 border-t border-line pt-3">
          <summary className="text-sm font-semibold text-ink cursor-pointer">Pengaturan divisi</summary>
          <p className="text-sm text-ink-muted my-3">{division.description}</p>
          <dl className="space-y-3">
            <ModelPicker key={division.id} divisionId={division.id} current={division.model} />
            <ReligionPicker key={`agama-${division.id}`} divisionId={division.id} current={division.religion} />
            <Rules label="Boleh tanpa izin" items={division.permission.bash.allow} tone="text-ok" />
            <Rules label="Harus minta izin" items={division.permission.bash.ask} tone="text-warn" />
            <Rules label="Selalu ditolak" items={division.permission.bash.deny} tone="text-danger" />
          </dl>
        </details>
      ) : (
        <p className="text-sm text-ink-muted mt-4">Data divisi belum termuat dari server.</p>
      )}
    </PanelShell>
  );
}
