import { ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { timeAgo, useFetch } from "../lib/hooks.ts";
import { useDivisionName, useOffice } from "../state/store.ts";

interface AuditItem {
  id: string;
  actor: string;
  eventType: string;
  detailJson: string;
  occurredAt: string;
}

const VERB: Record<string, string> = {
  project_created: "membuat proyek",
  project_planned: "selesai merencanakan proyek",
  task_done: "menyelesaikan",
  task_failed: "gagal mengerjakan",
  approval_requested: "meminta izin"
};

const DECISION: Record<string, string> = { approved: "menyetujui permintaan izin", rejected: "menolak permintaan izin" };

function sentence(item: AuditItem, actorName: string) {
  let d: Record<string, string> = {};
  try {
    d = JSON.parse(item.detailJson);
  } catch {
    // detail rusak: tampilkan kalimat tanpa objek
  }
  if (item.eventType === "approval_decided") {
    return (
      <>
        <strong className="text-ink">{actorName}</strong> {DECISION[d.decision] ?? "memutuskan permintaan izin"}
      </>
    );
  }
  const object = d.title ?? d.summary ?? "";
  return (
    <>
      <strong className="text-ink">{actorName}</strong> {VERB[item.eventType] ?? item.eventType}
      {object && <span className="text-ink"> {d.summary ? <code className="font-mono">{object}</code> : `"${object}"`}</span>}
    </>
  );
}

export function ActivityPanel() {
  const version = useOffice((s) => s.version);
  const { data, error } = useFetch<AuditItem[]>("/api/audit", version);
  const nameOf = useDivisionName();
  const actor = (a: string) => (a === "system" ? "Sistem" : a === "web-user" ? "Anda" : nameOf(a));

  return (
    <PanelShell title="Aktivitas" subtitle="Catatan audit, terbaru di atas.">
      {error && <ErrorNote>{error}</ErrorNote>}
      {data?.length === 0 && (
        <p className="text-sm text-ink-muted">Belum ada aktivitas. Buat proyek atau tekan "Jalankan demo" untuk melihat catatan muncul di sini.</p>
      )}
      <ol className="space-y-2.5">
        {data?.map((item) => (
          <li key={item.id} className="text-sm text-ink-muted flex gap-3 justify-between">
            <span className="min-w-0">{sentence(item, actor(item.actor))}</span>
            <time className="text-xs shrink-0 tabular-nums" dateTime={item.occurredAt}>
              {timeAgo(item.occurredAt)}
            </time>
          </li>
        ))}
      </ol>
    </PanelShell>
  );
}
