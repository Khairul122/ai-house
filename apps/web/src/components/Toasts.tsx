import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../lib/hooks.ts";
import {
  type Toast,
  type ToastTone,
  dismiss,
  useToasts,
} from "../state/notify.ts";

const ICON: Record<ToastTone, typeof Info> = {
  info: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
};

function Item({ t }: { t: Toast }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const Icon = ICON[t.tone];

  const decide = (decision: "approved" | "rejected") => {
    setBusy(true);
    setError(false);
    postJson(`/api/approvals/${t.approvalId}/decision`, { decision })
      .then(() => dismiss(t.id))
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  };

  return (
    <li className={`toast toast-${t.tone}`}>
      <Icon className="toast-icon" aria-hidden />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="toast-main"
          onClick={() => {
            if (t.to) navigate(t.to);
            if (!t.approvalId) dismiss(t.id);
          }}
        >
          <span className="toast-title">{t.title}</span>
          {t.body && (
            <span className={`toast-body${t.approvalId ? " font-mono" : ""}`}>
              {t.body}
            </span>
          )}
        </button>
        {t.approvalId && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="btn btn-sm btn-ok"
              disabled={busy}
              onClick={() => decide("approved")}
            >
              Setujui
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => decide("rejected")}
            >
              Tolak
            </button>
          </div>
        )}
        {error && (
          <span className="text-xs text-danger">
            Keputusan tidak terkirim. Coba lagi.
          </span>
        )}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => dismiss(t.id)}
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

// Tumpukan notifikasi di pojok kanan bawah (di ponsel: di atas dok).
export function Toasts() {
  const toasts = useToasts();
  return (
    <ol className="toasts" aria-live="polite" aria-label="Notifikasi">
      {toasts.map((t) => (
        <Item key={t.id} t={t} />
      ))}
    </ol>
  );
}
