import crypto from "node:crypto";
import { BadRequestException } from "@nestjs/common";

// Alur "hubungkan akun" TikTok tanpa menyalin token dengan tangan. Server membuat tautan izin, pemilik menyetujuinya
// di TikTok, lalu menempelkan alamat tujuan pengalihan (Redirect URI) ke AI House. Alamat itu berisi kode sekali pakai
// yang ditukar server menjadi token. Redirect URI boleh halaman apa saja yang terdaftar di portal TikTok, jadi tidak
// perlu server publik: halamannya boleh error, yang dibaca hanya alamatnya.

export const TIKTOK_SCOPES = "user.info.basic,video.upload,video.publish";
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TTL_MS = 10 * 60_000;

export interface TikTokPending {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  id: string;
  label: string;
  handle?: string;
}

// Disimpan di memori saja, tidak pernah ke disk, dan hilang setelah 10 menit atau sekali dipakai.
const pending = new Map<string, TikTokPending & { expires: number }>();

export function tiktokStart(p: TikTokPending): { state: string; url: string } {
  for (const [s, v] of pending) if (v.expires < Date.now()) pending.delete(s);
  const state = crypto.randomBytes(12).toString("hex");
  pending.set(state, { ...p, expires: Date.now() + TTL_MS });
  const url = `${AUTHORIZE_URL}?${new URLSearchParams({ client_key: p.clientKey, scope: TIKTOK_SCOPES, response_type: "code", redirect_uri: p.redirectUri, state })}`;
  return { state, url };
}

// Menerima alamat lengkap hasil pengalihan, atau hanya bagian "?code=...&state=...".
export function parseRedirect(text: string): URLSearchParams {
  const raw = text.trim();
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw;
  return new URLSearchParams(query.split("#")[0]);
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function tiktokFinish(
  redirected: string,
  fetchFn: typeof fetch = fetch,
) {
  const q = parseRedirect(redirected);
  if (q.get("error"))
    throw new BadRequestException(
      `TikTok menolak izin: ${q.get("error_description") || q.get("error")}`,
    );
  const code = q.get("code");
  const state = q.get("state") ?? "";
  if (!code)
    throw new BadRequestException(
      "Alamat yang ditempel tidak berisi code=. Salin seluruh alamat dari address bar setelah menyetujui izin.",
    );
  const p = pending.get(state);
  if (!p || p.expires < Date.now())
    throw new BadRequestException(
      "Sesi hubungkan tidak ditemukan atau sudah lewat 10 menit. Mulai lagi dari 'Buat tautan izin'.",
    );
  pending.delete(state); // kode hanya berlaku sekali
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: p.clientKey,
      client_secret: p.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: p.redirectUri,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    throw new BadRequestException(
      `TikTok menolak penukaran kode: ${body.error_description || body.error || `HTTP ${res.status}`}. Kode berlaku sekali dan singkat, ulangi dari awal.`,
    );
  }
  return {
    pending: p,
    tokens: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? "",
      scope: body.scope ?? "",
    },
  };
}
