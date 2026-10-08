import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorNote, Loading, PanelShell } from "../components/PanelShell.tsx";
import { lookOf, useCoordinatorLabel } from "../features/office/looks.ts";
import { postJson, timeAgo, useFetch } from "../lib/hooks.ts";
import { useAutonomy } from "../state/autonomy.ts";
import { useCoordinatorId, useDivisions, useFloors, useOffice } from "../state/store.ts";

interface Project {
  id: string;
  title: string;
  goal: string;
  status: string;
  floorId: string | null;
  kind: string;
  createdAt: string;
}

export const PROJECT_STATUS: Record<string, string> = {
  draft: "Draf",
  planning: "Menyusun rencana",
  plan_review: "Menunggu persetujuan rencana",
  in_progress: "Berjalan",
  completed: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan"
};

// Harus sama dengan batas di server (apps/api/src/modules/projects/application/brief.ts).
const ACCEPT = [".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".html", ".css", ".pdf", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".svg"];
const MAX_FILES = 10;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
    r.readAsDataURL(file);
  });
}

interface Form {
  title: string;
  goal: string;
  audience: string;
  scope: string;
  constraints: string;
  style: string;
  priority: "normal" | "tinggi" | "mendesak";
  notes: string;
}

const EMPTY: Form = { title: "", goal: "", audience: "", scope: "", constraints: "", style: "", priority: "normal", notes: "" };

function NewProjectForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const floors = useFloors();
  const [floorId, setFloorId] = useState(params.get("floor") ?? "");
  // datang dari panel lantai ("Beri proyek") saat formulir sudah terbuka
  useEffect(() => {
    const f = params.get("floor");
    if (f !== null) setFloorId(f);
  }, [params]);
  const floor = floors.find((f) => f.id === floorId);
  const all = useDivisions();
  const coordinator = useCoordinatorId();
  // proyek satu bidang direncanakan ketua bidangnya (bila ada), selain itu koordinator utama
  const planner = (floor && all.find((d) => d.floor === floor.id && d.role === "coordinator")?.id) || coordinator;
  const lead = planner ? lookOf(planner).short : "Koordinator";
  const divisions = all.filter((d) => d.id !== planner && (!floor || d.floor === floor.id));
  const mode = useAutonomy();
  const [form, setForm] = useState<Form>(EMPTY);
  const [picked, setPicked] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileHelp = useId();

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPT.includes(ext)) return setError(`Jenis berkas ${ext} tidak didukung (${f.name}).`);
      if (f.size > MAX_FILE) return setError(`${f.name} lebih dari 10 MB.`);
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (next.length > MAX_FILES) return setError(`Maksimal ${MAX_FILES} berkas.`);
    if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return setError("Total berkas lebih dari 25 MB.");
    setError(null);
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.goal.trim()) {
      setError("Judul dan tujuan wajib diisi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const encoded = await Promise.all(files.map(async (f) => ({ name: f.name, contentBase64: await toBase64(f) })));
      const body = {
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]).filter(([, v]) => v !== "")),
        floor: floor?.id,
        divisions: picked.some((id) => divisions.some((d) => d.id === id)) ? picked.filter((id) => divisions.some((d) => d.id === id)) : undefined,
        files: encoded.length ? encoded : undefined
      };
      const p = await postJson<Project>("/api/projects", body);
      navigate(`/projects/${p.id}`);
    } catch (err) {
      setError(`Proyek gagal dibuat. ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 mb-6" noValidate>
      <label className="field">
        <span>Judul *</span>
        <input value={form.title} onChange={set("title")} maxLength={120} placeholder="Nama proyek" />
      </label>
      <label className="field">
        <span>Tujuan *</span>
        <textarea value={form.goal} onChange={set("goal")} rows={3} maxLength={4000} placeholder="Apa yang harus jadi dan untuk apa" />
      </label>

      {floors.length > 1 && (
        <label className="field">
          <span>Ditujukan untuk</span>
          <select value={floorId} onChange={(e) => setFloorId(e.target.value)}>
            <option value="">Seluruh gedung (semua bidang)</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id} disabled={!f.divisionIds.length}>
                Lantai {f.level + 1}: {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="form-group">
        <legend>Detail kebutuhan (opsional, makin lengkap makin tepat)</legend>
        <label className="field">
          <span>Target pengguna</span>
          <input value={form.audience} onChange={set("audience")} maxLength={1500} placeholder="Siapa yang memakai hasilnya" />
        </label>
        <label className="field">
          <span>Fitur dan ruang lingkup</span>
          <textarea value={form.scope} onChange={set("scope")} rows={3} maxLength={4000} placeholder="Halaman, fitur, atau bagian yang harus ada" />
        </label>
        <label className="field">
          <span>Teknologi dan batasan</span>
          <input value={form.constraints} onChange={set("constraints")} maxLength={2000} placeholder="Mis. HTML statis tanpa framework, harus jalan di ponsel" />
        </label>
        <label className="field">
          <span>Gaya dan nuansa</span>
          <input value={form.style} onChange={set("style")} maxLength={1500} placeholder="Warna, nada bahasa, contoh referensi" />
        </label>
        <label className="field">
          <span>Prioritas</span>
          <select value={form.priority} onChange={set("priority")}>
            <option value="normal">Normal</option>
            <option value="tinggi">Tinggi</option>
            <option value="mendesak">Mendesak</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="form-group">
        <legend>Divisi yang dilibatkan</legend>
        <p className="text-xs text-ink-muted -mt-1 mb-1">Kosongkan bila {lead} yang menentukan.</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {divisions.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm text-ink min-h-[32px]">
              <input
                type="checkbox"
                checked={picked.includes(d.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))}
              />
              <span className="min-w-0">
                {d.name}
                <span className="block text-xs text-ink-muted">{lookOf(d.id).name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>Berkas perencanaan</legend>
        <p id={fileHelp} className="text-xs text-ink-muted -mt-1 mb-1">
          PRD, sitemap, wireframe, logo, atau referensi. Maksimal 10 berkas, 10 MB per berkas, total 25 MB. Disimpan di folder brief/ proyek dan dibaca {lead}.
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          aria-describedby={fileHelp}
          onChange={(e) => addFiles(e.target.files)}
          className="block w-full text-sm text-ink file:mr-3 file:border file:border-line file:rounded file:px-3 file:py-1.5 file:bg-background file:text-ink"
        />
        {files.length > 0 && (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {files.map((f) => (
              <li key={`${f.name}${f.size}`} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-mono text-xs text-ink truncate">{f.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-ink-muted tabular-nums">{kb(f.size)}</span>
                  <button type="button" className="text-xs text-danger underline" onClick={() => setFiles((list) => list.filter((x) => x !== f))}>
                    Hapus
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <label className="field">
        <span>Catatan tambahan</span>
        <textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={4000} placeholder="Hal lain yang perlu diketahui tim" />
      </label>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (files.length ? "Mengunggah berkas…" : "Membuat…") : "Buat proyek"}
        </button>
        <span className="text-xs text-ink-muted">
          {mode === "auto" ? `${lead} langsung menyusun rencana dan divisi mulai bekerja.` : `${lead} menyusun rencana, lalu menunggu persetujuan Anda.`}
        </span>
      </div>
    </form>
  );
}

export function ProjectsPanel() {
  const lead = useCoordinatorLabel();
  const version = useOffice((s) => s.version);
  const { data, error } = useFetch<Project[]>("/api/projects", version);
  const floors = useFloors();

  return (
    <PanelShell title="Proyek" subtitle={`Tulis permintaan Anda di resepsionis. ${lead} membagi proyek seluruh gedung; proyek satu bidang dibagi ketua bidangnya.`}>
      <NewProjectForm />

      <h3 className="text-sm font-semibold text-ink mb-1">Semua proyek</h3>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <Loading label="Memuat proyek" />}
      {data?.length === 0 && <p className="text-sm text-ink-muted">Belum ada proyek. Isi formulir di atas untuk membuat yang pertama.</p>}
      <ul className="divide-y divide-line border-y border-line">
        {data?.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="py-3 px-1 flex items-start justify-between gap-3 hover:bg-line/20">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{p.title}</p>
                {(p.floorId || p.kind === "meeting") && (
                  <p className="text-xs text-ink-muted">
                    {p.kind === "meeting" ? "Rapat · " : ""}
                    {floors.find((f) => f.id === p.floorId)?.name ?? "Seluruh gedung"}
                  </p>
                )}
                <p className="text-sm text-ink-muted line-clamp-2">{p.goal}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-ink">{PROJECT_STATUS[p.status] ?? p.status}</p>
                <p className="text-xs text-ink-muted">{timeAgo(p.createdAt)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
