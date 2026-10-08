import {
  Box,
  Layers,
  LayoutGrid,
  LocateFixed,
  Pause,
  Play,
  RectangleHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type CameraView, camera, useCamera } from "../state/camera.ts";
import { useFloors } from "../state/store.ts";

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
  const floor = useCamera((c) => c.floor);
  const floors = useFloors();

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
      {floors.length > 1 && (
        <>
          <span className="view-sep" aria-hidden />
          <button
            type="button"
            className={`view-btn${floor === null ? " is-on" : ""}`}
            onClick={() => camera.setFloor(null)}
            aria-pressed={floor === null}
            title="Semua lantai"
            aria-label="Semua lantai"
          >
            <Layers className="w-4 h-4" aria-hidden />
          </button>
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`view-btn view-floor${floor === f.level ? " is-on" : ""}`}
              onClick={() => camera.setFloor(f.level)}
              aria-pressed={floor === f.level}
              title={`Lantai ${f.level + 1}: ${f.name}`}
              aria-label={`Lantai ${f.level + 1}: ${f.name}`}
            >
              {f.level + 1}
            </button>
          ))}
        </>
      )}
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
