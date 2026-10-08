import { Html } from "@react-three/drei";
import { X } from "lucide-react";
import { useEffect } from "react";
import { Bar, useSim } from "../../panels/CharacterCard.tsx";
import { STATUS_LABEL } from "../../panels/DivisionsPanel.tsx";
import { setFocus } from "../../state/focus.ts";
import type { AgentStatus } from "../../state/reduce.ts";
import { useDivisionName } from "../../state/store.ts";
import { useLook } from "./looks.ts";
import { EMOTION_LABEL, NEED_LABEL, type Need, mood } from "./sims.ts";

// Kartu kecil di atas kepala karakter yang diklik: perasaan, kegiatan, kebutuhan, dan tugasnya.
export function CharacterPeek({
  id,
  status,
  task,
  onOpen,
}: { id: string; status: AgentStatus; task?: string; onOpen: () => void }) {
  const look = useLook(id);
  const sim = useSim(id);
  const nameOf = useDivisionName();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Html position={[0, 2.3, 0]} center zIndexRange={[25, 15]}>
      <section
        className="peek-card"
        style={{ borderTopColor: look.accent }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base leading-tight text-ink">
              {look.name}
            </p>
            <p className="text-xs text-ink-muted truncate">{nameOf(id)}</p>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => setFocus(null)}
            aria-label="Tutup kartu"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </header>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={`tag tag-${status}`}>{STATUS_LABEL[status]}</span>
          <span className={`tag emotion-${sim.emotion}`}>
            {EMOTION_LABEL[sim.emotion]}
          </span>
        </div>
        <p className="text-xs text-ink mt-2">
          {task && status !== "idle" ? `Tugas: ${task}` : sim.activity}
        </p>
        <div className="mt-2">
          <Bar label="Suasana hati" value={mood(sim.needs)} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1.5">
          {(Object.keys(NEED_LABEL) as Need[]).map((n) => (
            <Bar key={n} label={NEED_LABEL[n]} value={sim.needs[n]} />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary w-full mt-3"
          onClick={onOpen}
        >
          Buka profil dan pekerjaan
        </button>
      </section>
    </Html>
  );
}
