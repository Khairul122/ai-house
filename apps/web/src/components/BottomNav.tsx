import { CheckSquare, FolderKanban, History, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useOffice } from "../state/store.ts";

const ITEMS = [
  { label: "Proyek", path: "/projects", icon: FolderKanban },
  { label: "Persetujuan", path: "/approvals", icon: CheckSquare },
  { label: "Aktivitas", path: "/activity", icon: History },
  { label: "Divisi", path: "/divisions", icon: Users }
];

export function BottomNav() {
  const { pathname } = useLocation();
  const pending = useOffice((s) => Object.values(s.agents).filter((a) => a.approval).length);

  return (
    <nav className="dock" aria-label="Panel utama">
      {ITEMS.map(({ label, path, icon: Icon }) => {
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
