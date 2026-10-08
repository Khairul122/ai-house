import { Building2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Empty, ErrorNote, PanelShell } from "../components/PanelShell.tsx";
import { lookOf } from "../features/office/looks.ts";
import { postJson, timeAgo } from "../lib/hooks.ts";
import { camera } from "../state/camera.ts";
import {
  type Floor,
  useDivisionName,
  useFloors,
  useMeetings,
} from "../state/store.ts";
import { PROJECT_STATUS } from "./ProjectsPanel.tsx";

function Members({ floor }: { floor: Floor }) {
  const nameOf = useDivisionName();
  return (
    <ul className="flex flex-wrap gap-1.5 mt-2">
      {floor.divisionIds.map((id) => (
        <li key={id}>
          <Link
            to={`/divisions/${id}`}
            className="tag inline-flex items-center gap-1.5 hover:text-ink"
          >
            <span
              className="swatch"
              style={{ background: lookOf(id).accent }}
              aria-hidden
            />
            {nameOf(id)}
            {id === floor.leadId && " (ketua)"}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Daftar lantai gedung: tiap lantai satu bidang dengan divisinya sendiri.
export function FloorsPanel() {
  const floors = useFloors();
  const navigate = useNavigate();
  return (
    <PanelShell
      title="Lantai & bidang"
      subtitle="Beri proyek ke satu bidang atau adakan rapat di ruang rapat lantainya."
    >
      {!floors.length && (
        <Empty icon={Building2} title="Belum ada lantai">
          Tambahkan house/floors.yaml dan isi `floor:` di berkas divisi.
        </Empty>
      )}
      <ul className="space-y-3">
        {[...floors].reverse().map((f) => (
          <li key={f.id} className="form-group">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-muted">
                  Lantai {f.level + 1}
                </p>
                <p className="text-base font-semibold text-ink">{f.name}</p>
                {f.description && (
                  <p className="text-sm text-ink-muted">{f.description}</p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost shrink-0"
                onClick={() => camera.setFloor(f.level)}
              >
                Lihat
              </button>
            </div>
            <Members floor={f} />
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => navigate(`/projects?floor=${f.id}`)}
                disabled={!f.divisionIds.length}
              >
                Beri proyek
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => navigate(`/floors/${f.id}`)}
                disabled={!f.divisionIds.length}
              >
                Rapat
              </button>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

// Satu lantai: adakan rapat bidang dan lihat rapat sebelumnya (notulen ada di hasil kerja rapat).
export function FloorPanel() {
  const { id } = useParams();
  const floor = useFloors().find((f) => f.id === id);
  const meetings = useMeetings().filter((m) => m.floorId === id);
  const navigate = useNavigate();
  const nameOf = useDivisionName();
  const [topic, setTopic] = useState("");
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // panel lantai membuka lantainya di kantor 3D
  useEffect(() => {
    if (floor) camera.setFloor(floor.level);
  }, [floor]);

  if (!floor) {
    return (
      <PanelShell title="Lantai">
        <p className="text-sm text-ink-muted">Lantai tidak ditemukan.</p>
      </PanelShell>
    );
  }
  const live = meetings.find((m) => m.status === "in_progress");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim().length < 3)
      return setError("Tulis topik rapat (minimal 3 karakter).");
    setBusy(true);
    setError(null);
    try {
      const p = await postJson<{ id: string }>(
        `/api/floors/${floor.id}/meetings`,
        { topic: topic.trim(), agenda: agenda.trim() || undefined },
      );
      navigate(`/projects/${p.id}`);
    } catch (err) {
      setError(`Rapat gagal dimulai. ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title={`Lantai ${floor.level + 1} · ${floor.name}`}
      subtitle={floor.description}
    >
      <Members floor={floor} />
      <div className="flex gap-2 flex-wrap mt-3 mb-5">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => navigate(`/projects?floor=${floor.id}`)}
        >
          Beri proyek ke bidang ini
        </button>
        <Link to="/floors" className="btn btn-sm btn-ghost">
          Semua lantai
        </Link>
      </div>

      <h3 className="text-sm font-semibold text-ink mb-1">Adakan rapat</h3>
      <p className="text-xs text-ink-muted mb-2">
        Semua divisi di lantai ini berkumpul di ruang rapat. Tiap divisi menulis
        masukan, lalu {floor.leadId ? nameOf(floor.leadId) : "ketua bidang"}{" "}
        menyusun notulen dan tindak lanjut di rapat/notulen.md.
      </p>
      {live ? (
        <p className="text-sm text-ink mb-5">
          Rapat sedang berlangsung:{" "}
          <Link to={`/projects/${live.id}`} className="underline">
            {live.title}
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3 mb-5" noValidate>
          <label className="field">
            <span>Topik *</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              placeholder="Mis. Rencana konten bulan Ramadan"
            />
          </label>
          <label className="field">
            <span>Agenda dan catatan</span>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Poin yang harus dibahas, data pendukung, keputusan yang dibutuhkan"
            />
          </label>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Memanggil tim…" : "Mulai rapat"}
          </button>
        </form>
      )}

      <h3 className="text-sm font-semibold text-ink mb-1">Rapat sebelumnya</h3>
      {!meetings.length && (
        <p className="text-sm text-ink-muted">Belum ada rapat di lantai ini.</p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {meetings.map((m) => (
          <li key={m.id}>
            <Link
              to={`/projects/${m.id}`}
              className="py-2.5 px-1 flex items-start justify-between gap-3 hover:bg-line/20"
            >
              <span className="text-sm text-ink min-w-0">
                {m.title.replace(/^Rapat [^:]+: /, "")}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-xs font-semibold text-ink">
                  {PROJECT_STATUS[m.status] ?? m.status}
                </span>
                <span className="block text-xs text-ink-muted">
                  {timeAgo(m.createdAt)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
