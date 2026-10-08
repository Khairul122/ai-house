import { History } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Empty,
  ErrorNote,
  Loading,
  PanelShell,
} from "../components/PanelShell.tsx";
import { timeAgo, useFetch } from "../lib/hooks.ts";
import { useDivisionName, useDivisions, useOffice } from "../state/store.ts";

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
  approval_requested: "meminta izin",
  plan_approved: "menyetujui rencana proyek",
  plan_rejected: "menolak rencana proyek",
  project_completed: "menyelesaikan proyek",
  project_stopped: "menghentikan proyek",
  permission_denied: "ditolak otomatis saat mencoba",
  emergency_stop: "menghentikan semua run",
};

const DECISION: Record<string, string> = {
  approved: "menyetujui permintaan izin",
  rejected: "menolak permintaan izin",
};

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
        <strong className="text-ink">{actorName}</strong>{" "}
        {DECISION[d.decision] ?? "memutuskan permintaan izin"}
      </>
    );
  }
  const object = d.title ?? d.summary ?? "";
  return (
    <>
      <strong className="text-ink">{actorName}</strong>{" "}
      {VERB[item.eventType] ?? item.eventType}
      {object && (
        <span className="text-ink">
          {" "}
          {d.summary ? (
            <code className="font-mono">{object}</code>
          ) : (
            `"${object}"`
          )}
        </span>
      )}
    </>
  );
}

// Kelompok filter: dicocokkan dengan awalan jenis event.
const FILTERS: [string, string, (type: string) => boolean][] = [
  ["all", "Semua", () => true],
  ["task", "Tugas", (t) => t.startsWith("task_")],
  [
    "approval",
    "Izin",
    (t) => t.startsWith("approval_") || t === "permission_denied",
  ],
  [
    "project",
    "Proyek",
    (t) => t.startsWith("project_") || t.startsWith("plan_"),
  ],
];

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Hari ini";
  if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

export function ActivityPanel() {
  const version = useOffice((s) => s.version);
  const { data, error } = useFetch<AuditItem[]>("/api/audit", version);
  const nameOf = useDivisionName();
  const divisionIds = new Set(useDivisions().map((d) => d.id));
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const actor = (a: string) =>
    a === "system" ? "Sistem" : a === "web-user" ? "Anda" : nameOf(a);

  const match = FILTERS.find(([key]) => key === filter)?.[2] ?? (() => true);
  const q = query.trim().toLowerCase();
  const shown = (data ?? []).filter(
    (item) =>
      match(item.eventType) &&
      (!q ||
        `${actor(item.actor)} ${item.detailJson}`.toLowerCase().includes(q)),
  );
  let lastDay = "";

  return (
    <PanelShell title="Aktivitas" subtitle="Catatan audit, terbaru di atas.">
      {error && <ErrorNote>{error}</ErrorNote>}
      {data && data.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <div
            className="segmented"
            style={{ gridTemplateColumns: `repeat(${FILTERS.length}, 1fr)` }}
            role="radiogroup"
            aria-label="Saring aktivitas"
          >
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filter === key}
                className={filter === key ? "is-on" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="field">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama divisi, tugas, atau perintah"
              aria-label="Cari aktivitas"
            />
          </label>
        </div>
      )}
      {!data && !error && <Loading label="Memuat aktivitas" />}
      {data?.length === 0 && (
        <Empty icon={History} title="Belum ada aktivitas">
          Catatan muncul di sini begitu Anda membuat proyek atau divisi mulai
          bekerja.
        </Empty>
      )}
      {data && data.length > 0 && shown.length === 0 && (
        <p className="text-sm text-ink-muted">Tidak ada catatan yang cocok.</p>
      )}
      <ol className="space-y-2.5">
        {shown.map((item) => {
          const day = dayLabel(item.occurredAt);
          const header = day !== lastDay;
          lastDay = day;
          return (
            <li key={item.id}>
              {header && (
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted mt-3 mb-1.5">
                  {day}
                </p>
              )}
              <div className="text-sm text-ink-muted flex gap-3 justify-between">
                <span className="min-w-0">
                  {divisionIds.has(item.actor) ? (
                    <Link
                      to={`/divisions/${item.actor}`}
                      className="hover:underline underline-offset-2"
                    >
                      {sentence(item, actor(item.actor))}
                    </Link>
                  ) : (
                    sentence(item, actor(item.actor))
                  )}
                </span>
                <time
                  className="text-xs shrink-0 tabular-nums"
                  dateTime={item.occurredAt}
                  title={new Date(item.occurredAt).toLocaleString("id-ID")}
                >
                  {timeAgo(item.occurredAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </PanelShell>
  );
}
