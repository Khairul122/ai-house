import { Link, useParams } from "react-router-dom";
import { PanelShell } from "../components/PanelShell.tsx";
import { lookOf } from "../features/office/looks.ts";
import type { AgentState, AgentStatus } from "../state/reduce.ts";
import { useDivisions } from "../state/store.ts";
import { useAgentStatus } from "../state/useAgentStatus.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";

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

export function DivisionPanel() {
  const { id = "" } = useParams();
  const division = useDivisions().find((d) => d.id === id);
  const { agent, status } = useAgentStatus(id);

  return (
    <PanelShell title={division?.name ?? id} subtitle={<StatusTag status={status} />}>
      <p className="text-sm text-ink mb-4">{statusLine(status, agent)}</p>

      {agent?.approval && (
        <div className="mb-5">
          <ApprovalCard a={{ ...agent.approval, divisionName: division?.name, taskTitle: agent.task?.title }} />
        </div>
      )}

      {division ? (
        <>
          <p className="text-sm text-ink-muted mb-4">{division.description}</p>
          <dl className="space-y-3 border-t border-line pt-4">
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Model</dt>
              <dd className="font-mono text-xs text-ink mt-0.5">{division.model}</dd>
            </div>
            <Rules label="Boleh tanpa izin" items={division.permission.bash.allow} tone="text-ok" />
            <Rules label="Harus minta izin" items={division.permission.bash.ask} tone="text-warn" />
            <Rules label="Selalu ditolak" items={division.permission.bash.deny} tone="text-danger" />
          </dl>
        </>
      ) : (
        <p className="text-sm text-ink-muted">Data divisi belum termuat dari server.</p>
      )}
    </PanelShell>
  );
}
