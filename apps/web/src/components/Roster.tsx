import { useNavigate } from "react-router-dom";
import { useLook } from "../features/office/looks.ts";
import { STATUS_LABEL } from "../panels/DivisionsPanel.tsx";
import { useCamera } from "../state/camera.ts";
import { type Division, useDivisions, useFloors } from "../state/store.ts";
import { useAgentStatus } from "../state/useAgentStatus.ts";

function Chip({
  d,
  index,
  selected,
}: { d: Division; index: number; selected: boolean }) {
  const navigate = useNavigate();
  const look = useLook(d.id);
  const { status, agent } = useAgentStatus(d.id);
  const task = status !== "idle" ? agent?.task?.title : undefined;
  // inisial nama karakter (mis. "Raka Pratama" → "RP"), lebih mudah dibedakan daripada nama divisi
  const words = look.name.split(/\s+/).filter(Boolean);
  const initials = (
    words.length > 1
      ? words[0][0] + words[words.length - 1][0]
      : look.short.slice(0, 2)
  ).toUpperCase();
  const line =
    status === "failed" || status === "waiting"
      ? `${STATUS_LABEL[status]}${task ? ` · ${task}` : ""}`
      : (task ?? STATUS_LABEL[status]);
  const key = index < 9 ? String(index + 1) : index === 9 ? "0" : null;

  return (
    <li>
      <button
        type="button"
        className={`chip chip-${status}${selected ? " is-selected" : ""}`}
        style={{ "--chip": look.accent } as React.CSSProperties}
        onClick={() => navigate(selected ? "/" : `/divisions/${d.id}`)}
        aria-pressed={selected}
        aria-label={`${d.name}: ${STATUS_LABEL[status]}${task ? `, ${task}` : ""}`}
      >
        <span className="chip-avatar" aria-hidden>
          {initials}
        </span>
        <span className="chip-text">
          <span className="chip-name">{look.short}</span>
          <span className="chip-status">{line}</span>
        </span>
        {key && (
          <kbd className="chip-key" aria-hidden>
            {key}
          </kbd>
        )}
      </button>
    </li>
  );
}

// Daftar divisi di sisi kiri: status langsung terlihat, satu klik (atau tombol angka) mendekat ke ruangannya.
// Mode satu lantai: hanya divisi di lantai itu. Nomor pintasan tetap mengikuti urutan semua divisi.
export function Roster({ selectedId }: { selectedId: string | null }) {
  const divisions = useDivisions();
  const level = useCamera((c) => c.floor);
  const floor = useFloors().find((f) => f.level === level);
  if (!divisions.length) return null;
  return (
    <nav className="roster" aria-label="Divisi">
      <ul>
        {divisions.map((d, i) =>
          floor && d.floor !== floor.id ? null : (
            <Chip key={d.id} d={d} index={i} selected={selectedId === d.id} />
          ),
        )}
      </ul>
    </nav>
  );
}
