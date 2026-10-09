import { useEffect, useId, useState } from "react";
import {
  RELIGION_LABEL,
  type Religion,
} from "../features/office/environment.ts";
import { useLook } from "../features/office/looks.ts";
import {
  EMOTION_LABEL,
  NEED_LABEL,
  type Need,
  type SimState,
  mood,
  simOf,
} from "../features/office/sims.ts";
import { fetchJson } from "../lib/api.ts";
import { reloadDivisions } from "../state/store.ts";

// Salinan keadaan simulasi, diperbarui berkala (simulasi berjalan di luar React).
export function useSim(id: string): SimState {
  const read = () => {
    const s = simOf(id);
    return { needs: { ...s.needs }, emotion: s.emotion, activity: s.activity };
  };
  const [sim, setSim] = useState(read);
  useEffect(() => {
    setSim(read());
    const t = setInterval(() => setSim(read()), 700);
    return () => clearInterval(t);
  }, [id]);
  return sim;
}

const tone = (v: number) =>
  v >= 60 ? "var(--ok)" : v >= 30 ? "var(--warn)" : "var(--danger)";

export function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="text-ink tabular-nums">{Math.round(value)}</span>
      </div>
      <div
        className="need-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <div
          className="need-fill"
          style={{ width: `${value}%`, background: tone(value) }}
        />
      </div>
    </div>
  );
}

// Kartu karakter ala The Sims: siapa dia, perasaannya, kebutuhannya, dan sedang apa.
export function CharacterCard({
  id,
  divisionName,
  religion,
}: { id: string; divisionName: string; religion?: string }) {
  const look = useLook(id);
  const sim = useSim(id);
  const m = mood(sim.needs);

  return (
    <section className="character-card" style={{ borderTopColor: look.accent }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-ink leading-tight">
            {look.name}
          </p>
          <p className="text-xs text-ink-muted">
            {divisionName}
            {religion &&
              ` · ${RELIGION_LABEL[religion as Religion] ?? religion}`}
          </p>
        </div>
        <span className={`tag emotion-${sim.emotion} shrink-0`}>
          {EMOTION_LABEL[sim.emotion]}
        </span>
      </div>

      <p className="text-sm text-ink mt-2">
        <span className="text-ink-muted">Sedang: </span>
        {sim.activity}
      </p>

      <div className="mt-3">
        <Bar label="Suasana hati" value={m} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
        {(Object.keys(NEED_LABEL) as Need[]).map((n) => (
          <Bar key={n} label={NEED_LABEL[n]} value={sim.needs[n]} />
        ))}
      </div>

      {look.traits.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-3" aria-label="Sifat">
          {look.traits.map((t) => (
            <li key={t} className="trait">
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Pemilih agama karakter; disimpan ke berkas divisi.
export function ReligionPicker({
  divisionId,
  current,
}: { divisionId: string; current?: string }) {
  const [value, setValue] = useState(current ?? "");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const selectId = useId();

  const save = (religion: string) => {
    setValue(religion);
    setNote(null);
    fetchJson(`/api/divisions/${divisionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ religion }),
    })
      .then(() => {
        setNote({
          ok: true,
          text: "Tersimpan. Jadwal ibadahnya ikut berubah.",
        });
        return reloadDivisions();
      })
      .catch((e: Error) => setNote({ ok: false, text: e.message }));
  };

  return (
    <div>
      <label
        htmlFor={selectId}
        className="text-xs font-semibold text-ink-muted"
      >
        Agama
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => save(e.target.value)}
        className="block w-full mt-1 text-sm text-ink bg-background border border-line rounded px-2 py-1.5"
      >
        <option value="" disabled>
          Pilih agama
        </option>
        {(Object.keys(RELIGION_LABEL) as Religion[]).map((r) => (
          <option key={r} value={r}>
            {RELIGION_LABEL[r]}
          </option>
        ))}
      </select>
      {note && (
        <p className={`text-xs mt-1 ${note.ok ? "text-ok" : "text-danger"}`}>
          {note.text}
        </p>
      )}
    </div>
  );
}
