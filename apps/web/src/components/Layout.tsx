import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, FolderKanban, CheckSquare, Activity, Cpu } from "lucide-react";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { label: "Gedung", path: "/", icon: Building2 },
    { label: "Proyek", path: "/projects", icon: FolderKanban },
    { label: "Persetujuan", path: "/approvals", icon: CheckSquare },
    { label: "Aktivitas", path: "/activity", icon: Activity },
    { label: "Divisi", path: "/divisions", icon: Cpu }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-line p-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold">AH</div>
          <h1 className="font-bold text-lg text-ink">AI House</h1>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded font-medium text-sm transition-colors ${
                  active ? "bg-accent/10 text-accent font-semibold" : "text-ink-muted hover:bg-line/20 hover:text-ink"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 mb-16 md:mb-0 max-w-6xl mx-auto w-full">{children}</main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-line flex justify-around py-2 z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 text-xs px-2 py-1 ${
                active ? "text-accent font-semibold" : "text-ink-muted"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
