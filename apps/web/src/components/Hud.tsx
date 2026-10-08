import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Phase, PHASE_LABEL, type Weather, WEATHER_LABEL } from "../features/office/environment.ts";
import { postJson } from "../lib/hooks.ts";
import { type Autonomy, setAutonomy, useAutonomy } from "../state/autonomy.ts";
import { env, useEnv } from "../state/env.ts";
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

// Kontrol suasana: waktu, cuaca, suara, dan mode kerja.
function Ambience() {
  const phaseOverride = useEnv((st) => st.phaseOverride);
  const weatherMode = useEnv((st) => st.weatherMode);
  const autoWeather = useEnv((st) => st.autoWeather);
  const tempC = useEnv((st) => st.tempC);
  const sound = useEnv((st) => st.sound);
  const mode = useAutonomy();
  const [modeError, setModeError] = useState<string | null>(null);

  return (
    <details className="hud-menu">
      <summary className="hud-btn">Suasana</summary>
      <div className="hud-menu-body">
        <label className="field">
          <span>Waktu</span>
          <select value={phaseOverride ?? "auto"} onChange={(e) => env.setPhase(e.target.value === "auto" ? null : (e.target.value as Phase))}>
            <option value="auto">Ikuti jam nyata</option>
            {(Object.keys(PHASE_LABEL) as Phase[]).map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cuaca</span>
          <select value={weatherMode} onChange={(e) => env.setWeather(e.target.value as Weather | "auto")}>
            <option value="auto">
              Cuaca nyata Bandung ({WEATHER_LABEL[autoWeather]}
              {tempC !== null ? `, ${tempC}°C` : ""})
            </option>
            {(Object.keys(WEATHER_LABEL) as Weather[]).map((w) => (
              <option key={w} value={w}>
                {WEATHER_LABEL[w]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={sound} onChange={(e) => env.setSound(e.target.checked)} />
          Suara
        </label>
        <label className="field">
          <span>Mode kerja</span>
          <select
            value={mode}
            onChange={(e) => {
              setModeError(null);
              setAutonomy(e.target.value as Autonomy).catch((err: Error) => setModeError(err.message));
            }}
          >
            <option value="auto">Otomatis: kerja tanpa minta izin</option>
            <option value="ask">Minta izin untuk aksi berisiko</option>
          </select>
        </label>
        <p className="text-xs text-ink-muted">Aksi level 4 (mis. menghapus sistem) selalu ditolak di kedua mode.</p>
        {modeError && <p className="text-xs text-danger">{modeError}</p>}
      </div>
    </details>
  );
}

export function Hud({ selectedId }: { selectedId: string | null }) {
  const phase = useEnv(() => env.phase());
  const weather = useEnv(() => env.weather());
  useEnv((st) => st.tick); // perbarui jam di HUD
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
        <h1 className="font-display text-lg leading-none text-ink">Synectra AI House</h1>
        <p className="text-xs text-ink-muted mt-1">{summary(statuses ? statuses.split(",") : [])}</p>
        <p className="text-xs text-ink-muted">
          {PHASE_LABEL[phase]} · {env.now().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {WEATHER_LABEL[weather]}
        </p>
      </div>

      <div className="flex items-start gap-2 flex-wrap justify-end">
        {selectedId && (
          <button type="button" className="hud-btn" onClick={() => navigate("/")}>
            Seluruh kantor
          </button>
        )}
        <Ambience />
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
