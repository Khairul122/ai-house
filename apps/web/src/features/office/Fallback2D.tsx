import { STATUS_LABEL } from "../../panels/DivisionsPanel.tsx";
import { useDivisionName, useRooms } from "../../state/store.ts";
import { useAgentStatus } from "../../state/useAgentStatus.ts";
import { useLook } from "./looks.ts";

function Tile({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  const { status, agent } = useAgentStatus(id);
  const nameOf = useDivisionName();
  const look = useLook(id);
  return (
    <button type="button" className="fallback-tile" onClick={() => onSelect(id)} style={{ borderTopColor: look.accent }}>
      <span className="text-sm font-semibold text-ink">{nameOf(id)}</span>
      <span className={`tag tag-${status} self-start`}>{STATUS_LABEL[status]}</span>
      {agent?.task && status === "working" && <span className="text-xs text-ink-muted">{agent.task.title}</span>}
    </button>
  );
}

// Dipakai bila perangkat tidak mendukung WebGL: semua fitur tetap jalan tanpa tampilan 3D.
export function Fallback2D({ onSelect }: { onSelect: (id: string) => void }) {
  const rooms = useRooms();
  return (
    <div className="fallback">
      <p className="text-sm text-ink-muted mb-3">Perangkat ini tidak mendukung WebGL, jadi kantor ditampilkan sebagai denah sederhana.</p>
      <div className="fallback-grid">
        {rooms.map((r) => (
          <Tile key={r.id} id={r.id} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
