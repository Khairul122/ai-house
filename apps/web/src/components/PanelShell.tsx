import { type LucideIcon, X } from "lucide-react";
import React, { useEffect, useId, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

// Panel di atas kantor: samping kanan di laptop, lembar bawah di ponsel. Esc menutup.
export function PanelShell({ title, subtitle, children }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <aside ref={ref} className="panel" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
      <header className="panel-head">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-xl text-ink leading-tight">
            {title}
          </h2>
          {subtitle && <div className="text-sm text-ink-muted mt-0.5">{subtitle}</div>}
        </div>
        <button type="button" className="icon-btn" onClick={() => navigate("/")} aria-label="Tutup panel">
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </aside>
  );
}

// Kerangka abu-abu selama data dimuat, menggantikan teks "Memuat…".
export function Loading({ label }: { label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>
        <Icon className="w-5 h-5" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="max-w-xs">{children}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
