import {
  Box,
  LayoutGrid,
  LocateFixed,
  Pause,
  Play,
  RectangleHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type CameraView, camera, useCamera } from "../state/camera.ts";

const VIEWS: [CameraView, string, typeof Box][] = [
  ["iso", "Isometrik", Box],
  ["top", "Dari atas", LayoutGrid],
  ["front", "Dari depan", RectangleHorizontal],
];

// Tombol sudut kamera, tur otomatis, dan kembali ke seluruh kantor.
export function ViewControls() {
  const navigate = useNavigate();
  const view = useCamera((c) => c.view);
  const tour = useCamera((c) => c.tour);

  return (
    <div className="view-controls glass" role="toolbar" aria-label="Kamera">
      {VIEWS.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          className={`view-btn${view === key ? " is-on" : ""}`}
          onClick={() => camera.setView(key)}
          aria-pressed={view === key}
          title={label}
          aria-label={label}
        >
          <Icon className="w-4 h-4" aria-hidden />
        </button>
      ))}
      <span className="view-sep" aria-hidden />
      <button
        type="button"
        className={`view-btn view-tour${tour ? " is-on" : ""}`}
        onClick={() => {
          if (!tour) navigate("/");
          camera.setTour(!tour);
        }}
        aria-pressed={tour}
        title={tour ? "Hentikan tur" : "Tur otomatis ke ruangan yang aktif"}
      >
        {tour ? (
          <Pause className="w-4 h-4" aria-hidden />
        ) : (
          <Play className="w-4 h-4" aria-hidden />
        )}
        <span>{tour ? "Hentikan" : "Tur"}</span>
      </button>
      <button
        type="button"
        className="view-btn"
        onClick={() => {
          camera.setTour(false);
          camera.setView(camera.get().view);
          navigate("/");
        }}
        title="Seluruh kantor"
        aria-label="Seluruh kantor"
      >
        <LocateFixed className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
