import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../lib/hooks.ts";
import { useOffice } from "../state/store.ts";

function summary(statuses: string[]): string {
  const working = statuses.filter((s) => s === "working").length;
  const waiting = statuses.filter((s) => s === "waiting").length;
  const failed = statuses.filter((s) => s === "failed").length;
  const parts: string[] = [];
  if (working) parts.push(`${working} divisi bekerja`);
  if (waiting) parts.push(`${waiting} menunggu izin Anda`);
  if (failed) parts.push(`${failed} gagal`);
  return parts.length ? parts.join(" · ") : "Semua divisi sedang santai";
}

// Layar penuh untuk seluruh aplikasi (kanvas 3D + panel). Tombol F sebagai pintasan.
function useFullscreen() {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if (e.key.toLowerCase() === "f" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) toggle();
    };
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return full;
}

function toggle() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

export function Hud({ selectedId }: { selectedId: string | null }) {
  const full = useFullscreen();
  const navigate = useNavigate();
  const connection = useOffice((s) => s.connection);
  const statuses = useOffice((s) => Object.values(s.agents).map((a) => a.status).join(","));
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const runDemo = () => {
    setDemoBusy(true);
    setDemoError(null);
    postJson("/api/dev/simulate", {})
      .catch(() => setDemoError("Demo gagal dimulai. Backend aktif?"))
      .finally(() => setTimeout(() => setDemoBusy(false), 4000));
  };

  return (
    <div className="hud">
      <div className="hud-card">
        <h1 className="font-display text-lg leading-none text-ink">AI House</h1>
        <p className="text-xs text-ink-muted mt-1">{summary(statuses ? statuses.split(",") : [])}</p>
      </div>

      <div className="flex items-start gap-2 flex-wrap justify-end">
        {selectedId && (
          <button type="button" className="hud-btn" onClick={() => navigate("/")}>
            Seluruh kantor
          </button>
        )}
        <button type="button" className="hud-btn" onClick={toggle} aria-pressed={full} title="Pintasan: F">
          {full ? "Keluar layar penuh" : "Layar penuh"}
        </button>
        {import.meta.env.DEV && (
          <div className="flex flex-col items-end">
            <button type="button" className="hud-btn" onClick={runDemo} disabled={demoBusy}>
              {demoBusy ? "Demo berjalan…" : "Jalankan demo"}
            </button>
            {demoError && <span className="text-xs text-danger mt-1 hud-card py-1">{demoError}</span>}
          </div>
        )}
        <div className="hud-card py-1.5 text-xs flex items-center gap-1.5" aria-live="polite">
          <span className={`conn-dot conn-${connection}`} aria-hidden />
          {connection === "live" && "Tersambung"}
          {connection === "connecting" && "Menyambung…"}
          {connection === "offline" && "Server tidak terjangkau, mencoba lagi…"}
        </div>
      </div>
    </div>
  );
}
