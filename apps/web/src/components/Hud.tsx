import {
  Cloud,
  CloudRain,
  Maximize2,
  Minimize2,
  Moon,
  Search,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PHASE_LABEL,
  type Phase,
  WEATHER_LABEL,
  type Weather,
} from "../features/office/environment.ts";
import {
  isTyping,
  toggleFullscreen,
  useIsFullscreen,
} from "../lib/fullscreen.ts";
import { type Autonomy, setAutonomy, useAutonomy } from "../state/autonomy.ts";
import { env, useEnv } from "../state/env.ts";
import { type AgentStatus, visibleStatus } from "../state/reduce.ts";
import { useDivisions, useHouse, useOffice } from "../state/store.ts";

const PHASE_ICON: Record<Phase, typeof Sun> = {
  pagi: Sunrise,
  siang: Sun,
  sore: Sunset,
  malam: Moon,
};
const WEATHER_ICON: Record<Weather, typeof Sun> = {
  cerah: Cloud,
  panas: Sun,
  dingin: Snowflake,
  hujan: CloudRain,
};

// Kontrol suasana: waktu, cuaca, suara, dan mode kerja.
function Ambience() {
  const phaseOverride = useEnv((st) => st.phaseOverride);
  const weatherMode = useEnv((st) => st.weatherMode);
  const autoWeather = useEnv((st) => st.autoWeather);
  const tempC = useEnv((st) => st.tempC);
  const mode = useAutonomy();
  const city = useHouse()?.city;
  const [modeError, setModeError] = useState<string | null>(null);

  return (
    <details className="hud-menu">
      <summary
        className="hud-btn hud-icon"
        aria-label="Suasana dan mode kerja"
        title="Suasana dan mode kerja"
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden />
      </summary>
      <div className="hud-menu-body">
        <label className="field">
          <span>Waktu</span>
          <select
            value={phaseOverride ?? "auto"}
            onChange={(e) =>
              env.setPhase(
                e.target.value === "auto" ? null : (e.target.value as Phase),
              )
            }
          >
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
          <select
            value={weatherMode}
            onChange={(e) => env.setWeather(e.target.value as Weather | "auto")}
          >
            <option value="auto">
              Cuaca nyata{city ? ` ${city}` : ""} ({WEATHER_LABEL[autoWeather]}
              {tempC !== null ? `, ${tempC}°C` : ""})
            </option>
            {(Object.keys(WEATHER_LABEL) as Weather[]).map((w) => (
              <option key={w} value={w}>
                {WEATHER_LABEL[w]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <span>Mode kerja</span>
          <div className="segmented" role="radiogroup" aria-label="Mode kerja">
            {(
              [
                ["auto", "Otomatis"],
                ["ask", "Minta izin"],
              ] as [Autonomy, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                className={mode === value ? "is-on" : ""}
                onClick={() => {
                  setModeError(null);
                  setAutonomy(value).catch((err: Error) =>
                    setModeError(err.message),
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-ink-muted">
          {mode === "auto"
            ? "Divisi bekerja tanpa menunggu izin. "
            : "Aksi berisiko menunggu keputusan Anda. "}
          Aksi level 4 selalu ditolak.
        </p>
        {modeError && <p className="text-xs text-danger">{modeError}</p>}
      </div>
    </details>
  );
}

// Ringkasan status yang bisa diklik: bekerja berganti-ganti ke divisi berikutnya, menunggu membuka persetujuan.
function StatusChips() {
  const navigate = useNavigate();
  const divisions = useDivisions();
  const agents = useOffice((s) => s.agents);
  const [cursor, setCursor] = useState(0);
  const byStatus = (s: AgentStatus) =>
    divisions.filter((d) => visibleStatus(agents[d.id]) === s).map((d) => d.id);
  const working = byStatus("working");
  const waiting = byStatus("waiting");
  const failed = byStatus("failed");

  if (!working.length && !waiting.length && !failed.length) {
    return (
      <p className="hud-sub">
        {divisions.length
          ? `${divisions.length} divisi sedang santai`
          : "Menunggu daftar divisi…"}
      </p>
    );
  }
  return (
    <div className="hud-chips">
      {working.length > 0 && (
        <button
          type="button"
          className="stat stat-working"
          title="Klik untuk melihat divisi yang bekerja satu per satu"
          onClick={() => {
            navigate(`/divisions/${working[cursor % working.length]}`);
            setCursor((c) => c + 1);
          }}
        >
          <span className="stat-dot" aria-hidden />
          {working.length} bekerja
        </button>
      )}
      {waiting.length > 0 && (
        <button
          type="button"
          className="stat stat-waiting"
          onClick={() => navigate("/approvals")}
        >
          <span className="stat-dot" aria-hidden />
          {waiting.length} menunggu izin
        </button>
      )}
      {failed.length > 0 && (
        <button
          type="button"
          className="stat stat-failed"
          onClick={() => navigate(`/divisions/${failed[0]}`)}
        >
          <span className="stat-dot" aria-hidden />
          {failed.length} gagal
        </button>
      )}
    </div>
  );
}

export function Hud({ onOpenPalette }: { onOpenPalette: () => void }) {
  const phase = useEnv(() => env.phase());
  const weather = useEnv(() => env.weather());
  const tempC = useEnv((st) => st.tempC);
  const sound = useEnv((st) => st.sound);
  useEnv((st) => st.tick); // perbarui jam di HUD
  const full = useIsFullscreen();
  const connection = useOffice((s) => s.connection);
  const house = useHouse();
  const PhaseIcon = PHASE_ICON[phase];
  const WeatherIcon = WEATHER_ICON[weather];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "f" &&
        !isTyping(e) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      )
        toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hud">
      <div className="hud-card hud-brand">
        <div className="flex items-center gap-2">
          <span
            className={`conn-dot conn-${connection}`}
            title={
              connection === "live"
                ? "Tersambung"
                : connection === "offline"
                  ? "Server tidak terjangkau"
                  : "Menyambung"
            }
          />
          <h1 className="font-display text-lg leading-none text-ink truncate">
            {house?.name ?? "AI House"}
          </h1>
        </div>
        <p className="hud-sub hud-time">
          <PhaseIcon className="w-3.5 h-3.5" aria-hidden />
          {PHASE_LABEL[phase]} ·{" "}
          {env.now().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          <WeatherIcon className="w-3.5 h-3.5 ml-1" aria-hidden />
          {WEATHER_LABEL[weather]}
          {tempC !== null && ` ${tempC}°C`}
        </p>
        <StatusChips />
        {connection === "offline" && (
          <p className="text-xs text-warn mt-1">
            Server tidak terjangkau, mencoba lagi…
          </p>
        )}
      </div>

      <div className="hud-actions">
        <button
          type="button"
          className="hud-btn hud-search"
          onClick={onOpenPalette}
          title="Palet perintah (Ctrl K)"
        >
          <Search className="w-4 h-4" aria-hidden />
          <span className="hud-search-label">Cari atau perintah</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button
          type="button"
          className="hud-btn hud-icon"
          onClick={() => env.setSound(!sound)}
          aria-pressed={sound}
          aria-label={sound ? "Matikan suara" : "Nyalakan suara"}
          title={sound ? "Matikan suara" : "Nyalakan suara"}
        >
          {sound ? (
            <Volume2 className="w-4 h-4" aria-hidden />
          ) : (
            <VolumeX className="w-4 h-4" aria-hidden />
          )}
        </button>
        <Ambience />
        <button
          type="button"
          className="hud-btn hud-icon"
          onClick={toggleFullscreen}
          aria-pressed={full}
          aria-label="Layar penuh"
          title="Layar penuh (F)"
        >
          {full ? (
            <Minimize2 className="w-4 h-4" aria-hidden />
          ) : (
            <Maximize2 className="w-4 h-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
