import React from "react";

export type RoomStatus = "siaga" | "bekerja" | "menunggu" | "galat";

const BEACON_COLOR: Record<RoomStatus, string> = {
  siaga: "#8A867A",
  bekerja: "#2F7D4F",
  menunggu: "#9A6B0F",
  galat: "#B42318"
};

const STATUS_TEXT: Record<RoomStatus, string> = {
  siaga: "Siaga",
  bekerja: "Bekerja",
  menunggu: "Menunggu persetujuan",
  galat: "Galat"
};

interface VoxelRoomProps {
  label: string;
  status: RoomStatus;
  height: number;
  x: number;
  y: number;
  size: number;
  selected: boolean;
  onSelect: () => void;
}

// Jendela "lit" deterministik supaya tidak berkedip acak tiap render.
function windowLit(row: number, col: number, seed: number): boolean {
  return (row * 7 + col * 13 + seed) % 5 < 2;
}

export const VoxelRoom: React.FC<VoxelRoomProps> = ({
  label,
  status,
  height,
  x,
  y,
  size,
  selected,
  onSelect
}) => {
  const seed = label.length;
  const rows = Math.max(2, Math.floor(height / 18));

  return (
    <button
      type="button"
      className={`voxel-room${selected ? " is-selected" : ""}`}
      style={
        {
          "--w": `${size}px`,
          "--h": `${height}px`,
          "--beacon": BEACON_COLOR[status],
          left: `${x}px`,
          top: `${y}px`
        } as React.CSSProperties
      }
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Ruangan ${label}, status ${STATUS_TEXT[status]}`}
      title={`${label} — ${STATUS_TEXT[status]}`}
    >
      <span className="voxel-face voxel-roof">
        <span className="voxel-label">{label}</span>
        <span className="voxel-beacon" aria-hidden="true" />
      </span>

      <span className="voxel-face voxel-wall-a" aria-hidden="true">
        <span className="voxel-windows">
          {Array.from({ length: rows * 3 }, (_, i) => (
            <i key={i} className={windowLit(Math.floor(i / 3), i % 3, seed) ? "lit" : ""} />
          ))}
        </span>
      </span>

      <span className="voxel-face voxel-wall-b" aria-hidden="true">
        <span className="voxel-windows">
          {Array.from({ length: rows * 3 }, (_, i) => (
            <i key={i} className={windowLit(i % 3, Math.floor(i / 3), seed + 3) ? "lit" : ""} />
          ))}
        </span>
      </span>
    </button>
  );
};
