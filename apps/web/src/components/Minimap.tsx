import { useNavigate } from "react-router-dom";
import {
  CORRIDOR_HALF,
  FLOOR_HALF_X,
  FLOOR_HALF_Z,
  ROOM_D,
  getMeetingRooms,
  roomById,
} from "../features/office/layout.ts";
import { lookOf, tint, toneAt } from "../features/office/looks.ts";
import { STATUS_LABEL } from "../panels/DivisionsPanel.tsx";
import { useCamera } from "../state/camera.ts";
import { type AgentStatus, visibleStatus } from "../state/reduce.ts";
import {
  meetingOn,
  useDivisions,
  useFloors,
  useMeetings,
  useOffice,
  useRooms,
} from "../state/store.ts";

const STROKE: Record<AgentStatus, string> = {
  idle: "#C9C3BA",
  working: "#5B8DEF",
  waiting: "#E8A33A",
  failed: "#E5534B",
  done: "#3FB37F",
};

// Denah mini satu lantai (yang dilihat, atau lantai divisi terpilih): warna garis menunjukkan status
// tiap divisi, klik untuk mendekat.
export function Minimap({ selectedId }: { selectedId: string | null }) {
  const navigate = useNavigate();
  const floors = useFloors();
  useMeetings();
  const viewFloor = useCamera((c) => c.floor);
  const level =
    viewFloor ?? (selectedId ? roomById(selectedId)?.level : undefined) ?? 0;
  const floor = floors.find((f) => f.level === level);
  const rooms = useRooms().filter((r) => r.level === level);
  const meeting = getMeetingRooms().find((r) => r.level === level);
  const live = !!floor && meetingOn(floor.id);
  useDivisions(); // ikut digambar ulang saat persona (nama pendek) berubah
  const agents = useOffice((s) => s.agents);
  const tourTarget = useCamera((c) => (c.tour ? c.tourTarget : null));
  if (!rooms.length) return null;

  return (
    <nav className="minimap glass" aria-label="Denah kantor">
      <svg
        viewBox={`${-FLOOR_HALF_X - 0.5} ${-FLOOR_HALF_Z - 0.5} ${FLOOR_HALF_X * 2 + 1} ${FLOOR_HALF_Z * 2 + 1}`}
        role="img"
        aria-label="Denah ruangan"
      >
        <rect
          x={-FLOOR_HALF_X}
          y={-FLOOR_HALF_Z}
          width={FLOOR_HALF_X * 2}
          height={FLOOR_HALF_Z * 2}
          rx={0.8}
          className="minimap-floor"
        />
        <rect
          x={-FLOOR_HALF_X + 0.5}
          y={-CORRIDOR_HALF}
          width={FLOOR_HALF_X * 2 - 1}
          height={CORRIDOR_HALF * 2}
          rx={0.4}
          className="minimap-corridor"
        />
        {meeting && floor && (
          <g
            className="minimap-room"
            role="link"
            tabIndex={0}
            aria-label={`Ruang rapat ${floor.name}`}
            onClick={() => navigate(`/floors/${floor.id}`)}
            onKeyDown={(e) =>
              e.key === "Enter" && navigate(`/floors/${floor.id}`)
            }
          >
            <rect
              x={meeting.x - meeting.w / 2 + 0.15}
              y={meeting.z - ROOM_D / 2 + 0.15}
              width={meeting.w - 0.3}
              height={ROOM_D - 0.3}
              rx={0.5}
              fill="#FFFFFF"
              stroke={live ? "#5B8DEF" : "#C9C3BA"}
              strokeWidth={live ? 0.35 : 0.15}
              strokeDasharray="0.6 0.4"
              className={live ? "minimap-pulse" : undefined}
            />
            <text
              x={meeting.x}
              y={meeting.z + 0.45}
              textAnchor="middle"
              className="minimap-label"
            >
              Rapat
            </text>
          </g>
        )}
        {floor && floors.length > 1 && (
          <text
            x={-FLOOR_HALF_X + 1}
            y={FLOOR_HALF_Z - 0.6}
            className="minimap-label minimap-floor-label"
          >
            Lt {level + 1} · {floor.name}
          </text>
        )}
        {rooms.map((r, i) => {
          const status = visibleStatus(agents[r.id]);
          const active = r.id === selectedId || r.id === tourTarget;
          return (
            <g
              key={r.id}
              className="minimap-room"
              role="link"
              tabIndex={0}
              aria-label={`${lookOf(r.id).short}: ${STATUS_LABEL[status]}`}
              onClick={() =>
                navigate(r.id === selectedId ? "/" : `/divisions/${r.id}`)
              }
              onKeyDown={(e) =>
                e.key === "Enter" && navigate(`/divisions/${r.id}`)
              }
            >
              <rect
                x={r.x - r.w / 2 + 0.15}
                y={r.z - ROOM_D / 2 + 0.15}
                width={r.w - 0.3}
                height={ROOM_D - 0.3}
                rx={0.5}
                fill={tint(toneAt(i), active ? 0.15 : 0.5)}
                stroke={active ? "#202124" : STROKE[status]}
                strokeWidth={active || status !== "idle" ? 0.35 : 0.15}
                className={
                  status === "working" || status === "waiting"
                    ? "minimap-pulse"
                    : undefined
                }
              />
              <text
                x={r.x}
                y={r.z + 0.45}
                textAnchor="middle"
                className="minimap-label"
              >
                {lookOf(r.id).short}
              </text>
            </g>
          );
        })}
      </svg>
    </nav>
  );
}
