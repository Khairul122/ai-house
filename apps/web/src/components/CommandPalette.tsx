import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { lookOf } from "../features/office/looks.ts";
import { fetchJson } from "../lib/api.ts";
import { toggleFullscreen } from "../lib/fullscreen.ts";
import { STATUS_LABEL } from "../panels/DivisionsPanel.tsx";
import { setAutonomy, useAutonomy } from "../state/autonomy.ts";
import { env, useEnv } from "../state/env.ts";
import { visibleStatus } from "../state/reduce.ts";
import { office, useDivisions } from "../state/store.ts";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string;
}

export const SHORTCUTS: [string, string][] = [
  ["Ctrl K  /", "Buka palet perintah"],
  ["1 … 9, 0", "Pilih divisi sesuai urutan"],
  ["[  ]", "Divisi sebelumnya / berikutnya"],
  ["F", "Layar penuh"],
  ["Esc", "Tutup panel"],
];

// Palet perintah: cari divisi, proyek, panel, dan pengaturan dari satu kolom.
export function CommandPalette({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const divisions = useDivisions();
  const mode = useAutonomy();
  const sound = useEnv((s) => s.sound);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // proyek dimuat saat palet dibuka saja, supaya tidak membebani saat diam
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    input.current?.focus();
    fetchJson<ProjectRow[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => navigate(to);
    const agents = office.get().agents;
    return [
      ...divisions.map((d) => ({
        id: `div-${d.id}`,
        group: "Divisi",
        label: d.name,
        hint: STATUS_LABEL[visibleStatus(agents[d.id])],
        keywords: `${d.id} ${lookOf(d.id).name} ${lookOf(d.id).short}`,
        run: go(`/divisions/${d.id}`),
      })),
      ...projects.map((p) => ({
        id: `prj-${p.id}`,
        group: "Proyek",
        label: p.title,
        run: go(`/projects/${p.id}`),
      })),
      {
        id: "nav-new",
        group: "Buka",
        label: "Proyek baru",
        keywords: "buat resepsionis",
        run: go("/projects"),
      },
      {
        id: "nav-reports",
        group: "Buka",
        label: "Laporan",
        run: go("/reports"),
      },
      {
        id: "nav-approvals",
        group: "Buka",
        label: "Persetujuan",
        keywords: "izin",
        run: go("/approvals"),
      },
      {
        id: "nav-activity",
        group: "Buka",
        label: "Aktivitas",
        keywords: "audit log",
        run: go("/activity"),
      },
      {
        id: "nav-office",
        group: "Buka",
        label: "Seluruh kantor",
        keywords: "kamera reset",
        run: go("/"),
      },
      {
        id: "set-sound",
        group: "Pengaturan",
        label: sound ? "Matikan suara" : "Nyalakan suara",
        run: () => env.setSound(!sound),
      },
      {
        id: "set-mode",
        group: "Pengaturan",
        label:
          mode === "auto"
            ? "Mode kerja: minta izin untuk aksi berisiko"
            : "Mode kerja: otomatis",
        keywords: "autonomy otomatis izin",
        run: () =>
          void setAutonomy(mode === "auto" ? "ask" : "auto").catch(() => {}),
      },
      {
        id: "set-full",
        group: "Pengaturan",
        label: "Layar penuh",
        hint: "F",
        run: toggleFullscreen,
      },
    ];
  }, [divisions, projects, sound, mode, navigate]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(shown[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="palette-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="palette"
        role="dialog"
        aria-label="Palet perintah"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <label className="palette-search">
          <Search className="w-4 h-4 text-ink-muted" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Cari divisi, proyek, atau perintah"
            aria-label="Cari"
            aria-controls="palette-list"
            aria-activedescendant={
              shown[active] ? `cmd-${shown[active].id}` : undefined
            }
          />
          <kbd>Esc</kbd>
        </label>
        <ul
          ref={list}
          id="palette-list"
          className="palette-list"
          role="listbox"
        >
          {shown.length === 0 && (
            <li className="palette-empty">
              Tidak ada yang cocok dengan "{query}".
            </li>
          )}
          {shown.map((c, i) => {
            const header = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <li key={c.id} role="none">
                {header && <p className="palette-group">{c.group}</p>}
                <button
                  type="button"
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  className={`palette-item${i === active ? " is-active" : ""}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                >
                  {c.group === "Divisi" && (
                    <span
                      className="swatch"
                      style={{ background: lookOf(c.id.slice(4)).accent }}
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="palette-hint">{c.hint}</span>}
                  {i === active && (
                    <CornerDownLeft
                      className="w-3.5 h-3.5 text-ink-muted"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="palette-foot">
          {SHORTCUTS.map(([k, label]) => (
            <span key={k}>
              <kbd>{k}</kbd> {label}
            </span>
          ))}
        </footer>
      </div>
    </div>
  );
}
