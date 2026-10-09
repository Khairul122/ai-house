import { Share2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Empty,
  ErrorNote,
  Loading,
  PanelShell,
} from "../components/PanelShell.tsx";
import { fetchJson } from "../lib/api.ts";
import { postJson, timeAgo, useFetch } from "../lib/hooks.ts";
import { useDivisionName, useOffice } from "../state/store.ts";
import { fileUrl } from "./ProjectPanel.tsx";

interface Field {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
}
interface Platform {
  id: string;
  label: string;
  hint: string;
  fields: Field[];
}
interface Account {
  id: string;
  platform: string;
  label: string;
  handle: string | null;
  filled: string[];
}
interface Post {
  id: string;
  projectId: string;
  projectTitle: string;
  divisionId: string | null;
  accountId: string | null;
  caption: string;
  mediaJson: string;
  status: string;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

const POST_STATUS: Record<string, [string, string]> = {
  pending: ["Menunggu tinjauan", "tag-waiting"],
  publishing: ["Mengunggah…", "tag-working"],
  published: ["Tayang", "tag-done"],
  failed: ["Gagal", "tag-failed"],
  rejected: ["Ditolak", ""],
};

const PLATFORM_SHORT: Record<string, string> = {
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  telegram: "Telegram",
  webhook: "Webhook",
};

// Batas panjang caption per platform (YouTube: deskripsi; Telegram: caption media).
const LIMIT: Record<string, number> = {
  x: 280,
  tiktok: 2200,
  youtube: 5000,
  telegram: 1024,
};

const MEDIA = /\.(png|jpe?g|webp|gif|mp4|mov|webm|mp3|m4a|wav|pdf)$/i;

const send = (url: string, method: string, body?: unknown) =>
  fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// Hubungkan TikTok tanpa menyalin token: buat tautan izin, setujui di TikTok, tempel alamat hasil pengalihan.
function TikTokConnect({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    clientKey: "",
    clientSecret: "",
    redirectUri: "",
    id: "tiktok-utama",
    label: "TikTok AI House",
    handle: "",
  });
  const [link, setLink] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await postJson<{ url: string }>(
        "/api/social/connect/tiktok/start",
        form,
      );
      setLink(r.url);
      // rahasia sudah dipegang server (hanya di memori); hapus dari layar
      setForm((f) => ({ ...f, clientSecret: "" }));
    });
  };

  const finish = () =>
    void run(async () => {
      const r = await postJson<{ scope: string }>(
        "/api/social/connect/tiktok/finish",
        { redirected: pasted },
      );
      setLink(null);
      setPasted("");
      setOkMsg(
        r.scope.includes("video.upload")
          ? "TikTok terhubung. Izin video.upload aktif."
          : `TikTok terhubung, tetapi izin yang diberikan: ${r.scope || "(kosong)"}. Pastikan video.upload dan video.publish aktif di portal.`,
      );
      onDone();
    });

  return (
    <details className="form-group">
      <summary className="text-sm font-semibold text-ink cursor-pointer">
        Hubungkan TikTok (otomatis)
      </summary>
      {okMsg && <p className="text-sm text-ok mt-2">{okMsg}</p>}
      {!link ? (
        <form
          onSubmit={start}
          className="space-y-3 mt-2"
          noValidate
          autoComplete="off"
        >
          <p className="text-xs text-ink-muted">
            Isi Client key dan secret dari portal TikTok. Redirect URI harus{" "}
            <strong>sama persis</strong>
            dengan yang didaftarkan di portal. Secret hanya ditahan di memori
            server selama 10 menit.
          </p>
          <label className="field">
            <span>Client key *</span>
            <input
              value={form.clientKey}
              onChange={set("clientKey")}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Client secret *</span>
            <input
              type="password"
              value={form.clientSecret}
              onChange={set("clientSecret")}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Redirect URI *</span>
            <input
              value={form.redirectUri}
              onChange={set("redirectUri")}
              placeholder="https://..."
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>ID akun *</span>
              <input value={form.id} onChange={set("id")} maxLength={40} />
            </label>
            <label className="field">
              <span>Nama *</span>
              <input
                value={form.label}
                onChange={set("label")}
                maxLength={80}
              />
            </label>
          </div>
          <label className="field">
            <span>Username</span>
            <input
              value={form.handle}
              onChange={set("handle")}
              placeholder="@namaakun"
            />
          </label>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              busy || !form.clientKey || !form.clientSecret || !form.redirectUri
            }
          >
            {busy ? "Menyiapkan…" : "Buat tautan izin"}
          </button>
        </form>
      ) : (
        <div className="space-y-3 mt-2">
          <ol className="list-decimal pl-5 text-sm text-ink space-y-1">
            <li>
              Buka{" "}
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                tautan izin TikTok
              </a>{" "}
              dan setujui. Login sebagai akun yang akan dipakai memposting.
            </li>
            <li>
              Browser dialihkan ke Redirect URI Anda. Halamannya boleh error
              atau kosong; yang dibutuhkan hanya alamatnya.
            </li>
            <li>
              Salin <strong>seluruh alamat</strong> dari address bar (berisi
              code= dan state=), tempel di bawah.
            </li>
          </ol>
          <label className="field">
            <span>Alamat hasil pengalihan</span>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={3}
              placeholder="https://...?code=...&state=..."
            />
          </label>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={finish}
              disabled={busy || !pasted.trim()}
            >
              {busy ? "Menukar kode…" : "Selesaikan"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLink(null);
                setError(null);
              }}
            >
              Mulai lagi
            </button>
          </div>
        </div>
      )}
    </details>
  );
}

function AccountForm({
  platforms,
  onDone,
}: { platforms: Platform[]; onDone: () => void }) {
  const [platform, setPlatform] = useState(platforms[0]?.id ?? "");
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = platforms.find((x) => x.id === platform);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/social/accounts", {
        id: id.trim(),
        platform,
        label: label.trim(),
        handle: handle.trim() || undefined,
        secrets,
      });
      setId("");
      setLabel("");
      setHandle("");
      setSecrets({});
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="form-group">
      <summary className="text-sm font-semibold text-ink cursor-pointer">
        Daftarkan akun
      </summary>
      <form
        onSubmit={submit}
        className="space-y-3 mt-2"
        noValidate
        autoComplete="off"
      >
        <label className="field">
          <span>Platform</span>
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setSecrets({});
            }}
          >
            {platforms.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        {p && <p className="text-xs text-ink-muted -mt-1">{p.hint}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>ID akun *</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase())}
              maxLength={40}
              placeholder="tiktok-utama"
            />
          </label>
          <label className="field">
            <span>Nama *</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              placeholder="TikTok brand"
            />
          </label>
        </div>
        <label className="field">
          <span>Username</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={80}
            placeholder="@namabrand"
          />
        </label>
        {p?.fields.map((f) => (
          <label key={f.key} className="field">
            <span>
              {f.label}
              {f.required && " *"}
            </span>
            <input
              type={f.secret ? "password" : "text"}
              value={secrets[f.key] ?? ""}
              onChange={(e) =>
                setSecrets((s) => ({ ...s, [f.key]: e.target.value }))
              }
              autoComplete="off"
            />
          </label>
        ))}
        <p className="text-xs text-ink-muted">
          Token disimpan di basis data lokal House dan tidak pernah dikirim
          kembali ke browser.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !id || !label}
        >
          {busy ? "Menyimpan…" : "Simpan akun"}
        </button>
      </form>
    </details>
  );
}

function PostRow({
  post,
  accounts,
  onChange,
}: { post: Post; accounts: Account[]; onChange: () => void }) {
  const nameOf = useDivisionName();
  const [caption, setCaption] = useState(post.caption);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const media = JSON.parse(post.mediaJson) as string[];
  const editable = post.status === "pending" || post.status === "failed";
  const account = accounts.find((a) => a.id === post.accountId);
  const [label, tone] = POST_STATUS[post.status] ?? [post.status, ""];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!account) return setError("Pilih akun tujuan dulu.");
    // Posting publik tidak bisa ditarik kembali dari sini: konfirmasi eksplisit.
    if (
      !window.confirm(
        `Unggah ke ${account.label}${account.handle ? ` (@${account.handle})` : ""} sekarang? Posting akan tayang di platform.`,
      )
    )
      return;
    void run(async () => {
      if (caption !== post.caption)
        await send(`/api/social/posts/${post.id}`, "PATCH", { caption });
      await postJson(`/api/social/posts/${post.id}/publish`, {});
    });
  };

  return (
    <li className="py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/projects/${post.projectId}`}
            className="text-sm font-semibold text-ink hover:underline"
          >
            {post.projectTitle}
          </Link>
          <p className="text-xs text-ink-muted">
            {account
              ? `${PLATFORM_SHORT[account.platform] ?? account.platform} · ${account.label} · `
              : ""}
            {post.divisionId ? nameOf(post.divisionId) : "Pemilik"} ·{" "}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        <span className={`tag ${tone} shrink-0`}>{label}</span>
      </div>
      {editable ? (
        <>
          <label className="field">
            <span>Akun tujuan</span>
            <select
              value={post.accountId ?? ""}
              onChange={(e) =>
                void run(() =>
                  send(`/api/social/posts/${post.id}`, "PATCH", {
                    accountId: e.target.value || null,
                  }),
                )
              }
              disabled={busy}
            >
              <option value="">Pilih akun…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.platform}
                  {a.handle ? ` @${a.handle}` : ""})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Caption</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={10000}
            />
            {account && LIMIT[account.platform] && (
              <span
                className={`text-xs ${caption.length > LIMIT[account.platform] ? "text-danger" : "text-ink-muted"}`}
              >
                {caption.length}/{LIMIT[account.platform]} karakter
              </span>
            )}
          </label>
        </>
      ) : (
        <p className="text-sm text-ink whitespace-pre-wrap">{post.caption}</p>
      )}
      {media.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {media.map((m) => (
            <li key={m}>
              <a
                href={fileUrl(post.projectId, m)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline text-ink"
              >
                {m}
              </a>
            </li>
          ))}
        </ul>
      )}
      {post.resultUrl &&
        (post.resultUrl.startsWith("http") ? (
          <a
            href={post.resultUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline text-ink"
          >
            Lihat posting
          </a>
        ) : (
          <p className="text-xs text-ink-muted">Ref: {post.resultUrl}</p>
        ))}
      {post.error && (
        <p className="text-xs text-danger whitespace-pre-wrap">{post.error}</p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {editable && (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={publish}
            disabled={busy || !post.accountId}
          >
            {post.status === "failed" ? "Coba unggah lagi" : "Unggah sekarang"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() =>
              void run(() =>
                postJson(`/api/social/posts/${post.id}/reject`, {}),
              )
            }
            disabled={busy}
          >
            Tolak
          </button>
        </div>
      )}
    </li>
  );
}

function MediaPicker({
  projectId,
  media,
  setMedia,
}: {
  projectId: string;
  media: string[];
  setMedia: (fn: (m: string[]) => string[]) => void;
}) {
  const { data } = useFetch<{ path: string }[]>(
    `/api/projects/${projectId}/files`,
  );
  const choices = (data ?? []).filter((f) => MEDIA.test(f.path));
  return (
    <fieldset className="field">
      <span>Media</span>
      {data && !choices.length && (
        <p className="text-xs text-ink-muted">
          Belum ada gambar, video, atau audio di proyek ini.
        </p>
      )}
      {choices.map((f) => (
        <label
          key={f.path}
          className="flex items-center gap-2 text-xs font-mono text-ink min-h-[28px]"
        >
          <input
            type="checkbox"
            checked={media.includes(f.path)}
            onChange={(e) =>
              setMedia((m) =>
                e.target.checked
                  ? [...m, f.path]
                  : m.filter((x) => x !== f.path),
              )
            }
          />
          {f.path}
        </label>
      ))}
    </fieldset>
  );
}

// Pengajuan manual dari berkas hasil proyek mana pun.
function ManualPost({
  accounts,
  onDone,
}: { accounts: Account[]; onDone: () => void }) {
  const { data: projects } =
    useFetch<{ id: string; title: string }[]>("/api/projects");
  const [projectId, setProjectId] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/social/posts", {
        projectId,
        accountIds,
        caption,
        media,
      });
      setCaption("");
      setMedia([]);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="form-group">
      <summary className="text-sm font-semibold text-ink cursor-pointer">
        Ajukan unggahan dari hasil proyek
      </summary>
      <form onSubmit={submit} className="space-y-3 mt-2" noValidate>
        <label className="field">
          <span>Proyek</span>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setMedia([]);
            }}
          >
            <option value="">Pilih proyek…</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        {projectId && (
          <MediaPicker
            key={projectId}
            projectId={projectId}
            media={media}
            setMedia={setMedia}
          />
        )}
        <fieldset className="field">
          <span>Akun tujuan (boleh lebih dari satu)</span>
          {!accounts.length && (
            <p className="text-xs text-ink-muted">
              Belum ada akun; pilih akun nanti di antrean.
            </p>
          )}
          {accounts.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 text-sm text-ink min-h-[28px]"
            >
              <input
                type="checkbox"
                checked={accountIds.includes(a.id)}
                onChange={(e) =>
                  setAccountIds((ids) =>
                    e.target.checked
                      ? [...ids, a.id]
                      : ids.filter((x) => x !== a.id),
                  )
                }
              />
              {a.label}
              <span className="text-xs text-ink-muted">
                {PLATFORM_SHORT[a.platform] ?? a.platform}
                {a.handle ? ` @${a.handle}` : ""}
              </span>
            </label>
          ))}
          {accountIds.length > 1 && (
            <p className="text-xs text-ink-muted">
              Dibuat {accountIds.length} antrean, satu per akun; caption tiap
              platform bisa disesuaikan sebelum diunggah.
            </p>
          )}
        </fieldset>
        <label className="field">
          <span>Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={10000}
          />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !projectId}
        >
          Ajukan
        </button>
      </form>
    </details>
  );
}

// Akun sosial media terdaftar dan antrean unggahan dari bidang Content Creator.
export function SocialPanel() {
  const version = useOffice((s) => s.version);
  const platforms = useFetch<Platform[]>("/api/social/platforms");
  const accounts = useFetch<Account[]>("/api/social/accounts", version);
  const posts = useFetch<Post[]>("/api/social/posts", version);
  const list = accounts.data ?? [];
  const reload = () => {
    accounts.reload();
    posts.reload();
  };
  // filter antrean per platform: "" = semua, "-" = belum ada akun
  const [platform, setPlatform] = useState("");
  const [bulk, setBulk] = useState<string | null>(null);
  const platformOf = (p: Post) =>
    list.find((a) => a.id === p.accountId)?.platform ?? "-";
  const shown = (posts.data ?? []).filter(
    (p) => !platform || platformOf(p) === platform,
  );
  const ready = shown.filter((p) => p.status === "pending" && p.accountId);
  const used = [...new Set((posts.data ?? []).map(platformOf))];

  // Unggah semua antrean siap yang sedang tampil, satu per satu, dengan satu konfirmasi.
  const publishAll = async () => {
    const names = [
      ...new Set(
        ready.map((p) => list.find((a) => a.id === p.accountId)?.label ?? ""),
      ),
    ].join(", ");
    if (
      !window.confirm(
        `Unggah ${ready.length} posting ke ${names} sekarang? Semua akan tayang di platform masing-masing.`,
      )
    )
      return;
    const failed: string[] = [];
    for (const [i, p] of ready.entries()) {
      setBulk(`Mengunggah ${i + 1}/${ready.length}…`);
      await postJson(`/api/social/posts/${p.id}/publish`, {}).catch((e) =>
        failed.push(`${p.projectTitle}: ${(e as Error).message}`),
      );
    }
    setBulk(failed.length ? `Gagal: ${failed.join("; ")}` : null);
    posts.reload();
  };

  const remove = async (a: Account) => {
    if (
      !window.confirm(
        `Hapus akun ${a.label}? Token yang tersimpan ikut dihapus.`,
      )
    )
      return;
    await send(`/api/social/accounts/${a.id}`, "DELETE");
    reload();
  };

  return (
    <PanelShell
      title="Sosial Media"
      subtitle="Divisi Content Creator mengajukan unggahan; Anda meninjau lalu menekan unggah."
    >
      <h3 className="text-sm font-semibold text-ink mb-1">Akun terdaftar</h3>
      {accounts.error && <ErrorNote>{accounts.error}</ErrorNote>}
      {!list.length && accounts.data && (
        <p className="text-sm text-ink-muted mb-2">
          Belum ada akun. Daftarkan TikTok, X, YouTube, Facebook, Telegram, atau
          webhook.
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line mb-3">
        {list.map((a) => (
          <li
            key={a.id}
            className="py-2 px-1 flex items-center justify-between gap-3"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                {a.label}{" "}
                {a.handle && (
                  <span className="font-normal text-ink-muted">
                    @{a.handle}
                  </span>
                )}
              </span>
              <span className="block text-xs text-ink-muted">
                {platforms.data?.find((p) => p.id === a.platform)?.label ??
                  a.platform}{" "}
                · <span className="font-mono">{a.id}</span>
              </span>
            </span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => void remove(a)}
            >
              Hapus
            </button>
          </li>
        ))}
      </ul>
      {platforms.data && (
        <div className="space-y-2">
          <TikTokConnect onDone={reload} />
          <AccountForm platforms={platforms.data} onDone={reload} />
        </div>
      )}

      <h3 className="text-sm font-semibold text-ink mt-5 mb-1">
        Antrean unggahan
      </h3>
      <div className="mb-2">
        <ManualPost accounts={list} onDone={reload} />
      </div>
      {used.length > 1 && (
        <div
          className="flex flex-wrap gap-1.5 mb-2"
          role="group"
          aria-label="Filter platform"
        >
          {["", ...used].map((id) => (
            <button
              key={id || "semua"}
              type="button"
              className={`btn btn-sm ${platform === id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPlatform(id)}
              aria-pressed={platform === id}
            >
              {id === ""
                ? "Semua"
                : id === "-"
                  ? "Belum ada akun"
                  : (PLATFORM_SHORT[id] ?? id)}
            </button>
          ))}
        </div>
      )}
      {ready.length > 1 && (
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => void publishAll()}
            disabled={!!bulk && bulk.startsWith("Mengunggah")}
          >
            Unggah semua ({ready.length})
          </button>
          {bulk && <span className="text-xs text-ink-muted">{bulk}</span>}
        </div>
      )}
      {posts.error && <ErrorNote>{posts.error}</ErrorNote>}
      {!posts.data && !posts.error && <Loading label="Memuat antrean" />}
      {posts.data?.length === 0 && (
        <Empty icon={Share2} title="Antrean kosong">
          Beri proyek ke lantai Content Creator; divisi Social Media menulis
          pengajuan di publikasi/*.json.
        </Empty>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {shown.map((p) => (
          <PostRow
            key={`${p.id}${p.status}${p.accountId}`}
            post={p}
            accounts={list}
            onChange={posts.reload}
          />
        ))}
      </ul>
    </PanelShell>
  );
}
