import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "../../lib/api.ts";
import { RotateCcw, RotateCw, Play, Pause, RefreshCw, X } from "lucide-react";
import { VoxelRoom, type RoomStatus } from "./VoxelRoom.tsx";
import "./house3d.css";

interface Division {
  id: string;
  name: string;
  model: string;
  description: string;
  permission?: { bash?: { allow?: string[]; ask?: string[]; deny?: string[] } };
}

const SIZE = 120;
const GAP = 24;
const COLS = 4;
const GRID_W = COLS * (SIZE + GAP);
const GRID_H = Math.ceil(10 / COLS) * (SIZE + GAP);

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export const HousePage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rot, setRot] = useState(0);
  const [spin, setSpin] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; startRot: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchJson<Division[]>("/api/divisions")
      .then(setDivisions)
      .catch(() => setError("Gagal terhubung ke server backend (port 3000). Pastikan backend aktif."))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  // Rotasi otomatis (dihormati prefers-reduced-motion)
  useEffect(() => {
    if (!spin || reducedMotion) return;
    let raf = 0;
    const tick = () => {
      setRot((r) => r + 0.15);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spin, reducedMotion]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".house-detail")) return;
    dragRef.current = { x: e.clientX, startRot: rot };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setRot(d.startRot + (e.clientX - d.x) * 0.4);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const turn = useCallback((delta: number) => setRot((r) => r + delta), []);

  const selected = divisions.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gedung AI House</h2>
          <p className="text-sm text-ink-muted">Peta ruangan 3D — seret untuk memutar, klik ruangan untuk detail.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="house-ctrl" onClick={() => turn(-45)} aria-label="Putar kiri" title="Putar kiri">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button className="house-ctrl" onClick={() => turn(45)} aria-label="Putar kanan" title="Putar kanan">
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            className="house-ctrl"
            onClick={() => setSpin((s) => !s)}
            aria-pressed={spin}
            aria-label={spin ? "Hentikan putaran" : "Putar otomatis"}
            title={spin ? "Hentikan putaran" : "Putar otomatis"}
            disabled={reducedMotion}
          >
            {spin ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            className="house-ctrl"
            onClick={() => {
              setRot(0);
              setSelectedId(null);
            }}
            aria-label="Atur ulang tampilan"
            title="Atur ulang"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button className="house-ctrl" onClick={loadData} aria-label="Muat ulang data" title="Muat ulang data">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-danger/10 border-2 border-danger/40 rounded p-4 text-sm text-danger font-medium">{error}</div>
      ) : (
        <div
          ref={stageRef}
          className="house-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className={`house-scene${dragRef.current ? "" : " is-turning"}`}
            style={{ "--rot": `${rot}deg` } as React.CSSProperties}
          >
            <div className="house-ground" style={{ width: `${GRID_W + 80}px`, height: `${GRID_H + 80}px` }} />

            {divisions.map((d, i) => {
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              const rowsTotal = Math.ceil(divisions.length / COLS);
              return (
                <VoxelRoom
                  key={d.id}
                  label={d.name}
                  status={"siaga" as RoomStatus}
                  height={64 + ((i * 37) % 4) * 18}
                  size={SIZE}
                  x={col * (SIZE + GAP) - GRID_W / 2 + GAP / 2}
                  y={row * (SIZE + GAP) - rowsTotal * (SIZE + GAP) / 2 + GAP / 2}
                  selected={d.id === selectedId}
                  onSelect={() => setSelectedId(d.id === selectedId ? null : d.id)}
                />
              );
            })}
          </div>

          <span className="house-nameplate">
            {selected ? selected.name : `${divisions.length} divisi • seret untuk memutar`}
          </span>

          {selected && (
            <aside className="house-detail" aria-label={`Detail divisi ${selected.name}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-base leading-snug">{selected.name}</h3>
                <button
                  className="house-ctrl !w-8 !h-8 shrink-0"
                  onClick={() => setSelectedId(null)}
                  aria-label="Tutup detail"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-ink-muted mb-3">{selected.description}</p>
              <dl className="text-xs font-mono space-y-1 border-t border-line pt-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Model</dt>
                  <dd className="text-right">{selected.model}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Status</dt>
                  <dd>Siaga</dd>
                </div>
                {selected.permission?.bash && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Izin berisiko</dt>
                    <dd className="text-right">
                      {selected.permission.bash.ask?.length ?? 0} aksi butuh persetujuan
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
