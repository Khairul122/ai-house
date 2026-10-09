import { useId, useState } from "react";
import { ErrorNote } from "../components/PanelShell.tsx";
import { fetchJson } from "../lib/api.ts";
import { useFetch } from "../lib/hooks.ts";
import { reloadDivisions } from "../state/store.ts";

interface RouterModel {
  id: string;
  name: string;
  combo: boolean;
  owner: string;
}

// Pilih model/kombo dari 9router untuk satu divisi. Ketik untuk menyaring daftar.
export function ModelPicker({
  divisionId,
  current,
}: { divisionId: string; current: string }) {
  const { data: models, error } = useFetch<RouterModel[]>("/api/models");
  const [value, setValue] = useState(current.replace(/^9router\//, ""));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const listId = useId();
  const inputId = useId();

  const chosen = models?.find((m) => m.name === value.trim());
  const changed = `9router/${value.trim()}` !== current;

  const save = () => {
    if (!chosen) return;
    setBusy(true);
    setNote(null);
    fetchJson(`/api/divisions/${divisionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: chosen.id }),
    })
      .then(() => {
        setNote({
          ok: true,
          text: "Tersimpan. Berlaku untuk tugas berikutnya.",
        });
        return reloadDivisions();
      })
      .catch((e: Error) => setNote({ ok: false, text: e.message }))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-semibold text-ink-muted">
        Model
      </label>
      <div className="flex gap-2 mt-1">
        <input
          id={inputId}
          list={listId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ketik nama model atau kombo"
          className="flex-1 min-w-0 font-mono text-xs text-ink bg-background border border-line rounded px-2 py-1.5 focus:outline-accent"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !chosen || !changed}
          onClick={save}
        >
          Simpan
        </button>
      </div>
      <datalist id={listId}>
        {models?.map((m) => (
          <option key={m.id} value={m.name}>
            {m.combo ? "Kombo" : m.owner}
          </option>
        ))}
      </datalist>
      {error && (
        <ErrorNote>
          Daftar model tidak termuat: 9router tidak terjangkau.
        </ErrorNote>
      )}
      {models && value.trim() && !chosen && (
        <p className="text-xs text-warn mt-1">
          Tidak ada di 9router. Pilih dari daftar.
        </p>
      )}
      {note && (
        <p className={`text-xs mt-1 ${note.ok ? "text-ok" : "text-danger"}`}>
          {note.text}
        </p>
      )}
      {models && (
        <p className="text-xs text-ink-muted mt-1">
          {models.length} model tersedia di 9router, termasuk{" "}
          {models.filter((m) => m.combo).length} kombo.
        </p>
      )}
    </div>
  );
}
