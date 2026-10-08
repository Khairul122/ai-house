import { Building2, CheckSquare, FileText, FolderKanban, History, Share2, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAutonomy } from "../state/autonomy.ts";
import { useOffice } from "../state/store.ts";

export function BottomNav() {
  const { pathname } = useLocation();
  const pending = useOffice((s) => Object.values(s.agents).filter((a) => a.approval).length);
  const mode = useAutonomy();

  // Mode otomatis: Persetujuan hanya muncul bila memang ada yang menunggu.
  const items = [
    { label: "Proyek", path: "/projects", icon: FolderKanban },
    { label: "Lantai", path: "/floors", icon: Building2 },
    { label: "Sosmed", path: "/social", icon: Share2 },
    { label: "Laporan", path: "/reports", icon: FileText },
    ...(mode === "ask" || pending > 0 ? [{ label: "Persetujuan", path: "/approvals", icon: CheckSquare }] : []),
    { label: "Aktivitas", path: "/activity", icon: History },
    { label: "Divisi", path: "/divisions", icon: Users }
  ];

  return (
    <nav className="dock" aria-label="Panel utama">
      {items.map(({ label, path, icon: Icon }) => {
        const active = pathname.startsWith(path);
        return (
          <Link
            key={path}
            to={active ? "/" : path}
            className={`dock-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="w-4 h-4" aria-hidden />
            <span>{label}</span>
            {path === "/approvals" && pending > 0 && (
              <span className="dock-badge" aria-label={`${pending} menunggu`}>
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
