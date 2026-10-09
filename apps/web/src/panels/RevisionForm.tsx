import { useId, useState } from "react";
import { ErrorNote } from "../components/PanelShell.tsx";
import { useLook } from "../features/office/looks.ts";
import { postJson } from "../lib/hooks.ts";

// Meminta divisi memperbaiki hasil kerjanya. House membuat tugas "Revisi n: …" yang langsung dikerjakan.
export function RevisionForm({
  taskId,
  divisionId,
  onSent,
}: { taskId: string; divisionId: string; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const id = useId();
  const name = useLook(divisionId).name;

  if (sent)
    return (
      <p className="text-xs text-ok basis-full">
        Revisi dikirim ke {name}. Dikerjakan otomatis; hasilnya muncul sebagai
        tugas "Revisi".
      </p>
    );

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => setOpen(true)}
      >
        Minta revisi
      </button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 3) {
      setError("Tulis apa yang perlu diubah.");
      return;
    }
    setBusy(true);
    setError(null);
    postJson(`/api/tasks/${taskId}/revise`, { note: note.trim() })
      .then(() => {
        setSent(true);
        onSent?.();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} className="basis-full space-y-2" noValidate>
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">
        Apa yang perlu diubah {name}?
      </label>
      <textarea
        id={id}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Contoh: ganti warna utama jadi cokelat, perbesar tombol pesan, tambah bagian testimoni."
        className="block w-full text-sm text-ink bg-background border border-line rounded px-2 py-1.5 resize-y"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-sm btn-primary"
          disabled={busy}
        >
          {busy ? "Mengirim…" : "Kirim revisi"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Batal
        </button>
      </div>
    </form>
  );
}
