import path from "node:path";

// Pengunggah per platform sosial media. Semuanya memakai API resmi dengan token milik pemilik akun;
// token yang diperbarui (refresh) dikembalikan agar disimpan lagi.

export interface Media {
  name: string;
  mime: string;
  data: Buffer;
}

export interface PublishInput {
  caption: string;
  media: Media[];
}

export interface PublishResult {
  url: string | null; // tautan posting bila platform langsung memberikannya
  ref?: string; // id dari platform bila tautan belum tersedia (mis. TikTok masih memproses)
  secrets?: Record<string, string>; // token baru setelah diperbarui
}

type Secrets = Record<string, string>;

export interface Field {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
}

interface Platform {
  label: string;
  hint: string;
  fields: Field[];
  publish: (s: Secrets, post: PublishInput) => Promise<PublishResult>;
}

const f = (
  key: string,
  label: string,
  required = true,
  secret = true,
): Field => ({ key, label, required, secret });

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};
export const mimeOf = (file: string) =>
  MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok)
    throw new Error(
      `${new URL(url).host} HTTP ${res.status}: ${text.slice(0, 400)}`,
    );
  return (text ? JSON.parse(text) : {}) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const blob = (m: Media) => new Blob([new Uint8Array(m.data)], { type: m.mime });

// Token OAuth 2.0 berumur pendek; bila refresh token tersedia, minta token baru sebelum mengunggah.
async function refresh(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
) {
  return call<{ access_token: string; refresh_token?: string }>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(body),
  });
}

function rotated(
  s: Secrets,
  t: { access_token: string; refresh_token?: string },
): Secrets {
  return {
    ...s,
    accessToken: t.access_token,
    ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
  };
}

// ---------- X ----------

async function publishX(
  s: Secrets,
  post: PublishInput,
): Promise<PublishResult> {
  let secrets: Secrets | undefined;
  if (s.refreshToken && s.clientId) {
    const basic: Record<string, string> = s.clientSecret
      ? {
          Authorization: `Basic ${Buffer.from(`${s.clientId}:${s.clientSecret}`).toString("base64")}`,
        }
      : {};
    secrets = rotated(
      s,
      await refresh(
        "https://api.x.com/2/oauth2/token",
        {
          grant_type: "refresh_token",
          refresh_token: s.refreshToken,
          client_id: s.clientId,
        },
        basic,
      ),
    );
  }
  const auth = bearer((secrets ?? s).accessToken);
  if (post.media.length > 4)
    throw new Error("X: maksimal 4 media per posting.");
  const ids: string[] = [];
  for (const m of post.media) {
    if (m.mime.startsWith("image/") && m.mime !== "image/gif") {
      const fd = new FormData();
      fd.append("media", blob(m), m.name);
      fd.append("media_category", "tweet_image");
      ids.push(
        (
          await call<{ data: { id: string } }>(
            "https://api.x.com/2/media/upload",
            { method: "POST", headers: auth, body: fd },
          )
        ).data.id,
      );
      continue;
    }
    // Video dan GIF: unggah bertahap (initialize, append per 4 MB, finalize), lalu tunggu diproses.
    const category = m.mime === "image/gif" ? "tweet_gif" : "tweet_video";
    const init = await call<{ data: { id: string } }>(
      "https://api.x.com/2/media/upload/initialize",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: m.mime,
          total_bytes: m.data.length,
          media_category: category,
        }),
      },
    );
    const id = init.data.id;
    const CHUNK = 4 * 1024 * 1024;
    for (let i = 0; i * CHUNK < m.data.length; i++) {
      const fd = new FormData();
      fd.append("segment_index", String(i));
      fd.append(
        "media",
        new Blob(
          [new Uint8Array(m.data.subarray(i * CHUNK, (i + 1) * CHUNK))],
          { type: m.mime },
        ),
        m.name,
      );
      await call(`https://api.x.com/2/media/upload/${id}/append`, {
        method: "POST",
        headers: auth,
        body: fd,
      });
    }
    type Info = {
      data: {
        processing_info?: {
          state: string;
          check_after_secs?: number;
          error?: { message?: string };
        };
      };
    };
    let info = (
      await call<Info>(`https://api.x.com/2/media/upload/${id}/finalize`, {
        method: "POST",
        headers: auth,
      })
    ).data.processing_info;
    for (let n = 0; info && info.state !== "succeeded" && n < 60; n++) {
      if (info.state === "failed")
        throw new Error(
          `X gagal memproses ${m.name}: ${info.error?.message ?? "tanpa keterangan"}`,
        );
      await sleep((info.check_after_secs ?? 5) * 1000);
      info = (
        await call<Info>(
          `https://api.x.com/2/media/upload?command=STATUS&media_id=${id}`,
          { headers: auth },
        )
      ).data.processing_info;
    }
    ids.push(id);
  }
  const tweet = await call<{ data: { id: string } }>(
    "https://api.x.com/2/tweets",
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: post.caption,
        ...(ids.length ? { media: { media_ids: ids } } : {}),
      }),
    },
  );
  return { url: `https://x.com/i/web/status/${tweet.data.id}`, secrets };
}

// ---------- TikTok ----------

async function publishTikTok(
  s: Secrets,
  post: PublishInput,
): Promise<PublishResult> {
  const video = post.media.find((m) => m.mime.startsWith("video/"));
  if (!video) throw new Error("TikTok: butuh satu berkas video.");
  let secrets: Secrets | undefined;
  if (s.refreshToken && s.clientKey && s.clientSecret) {
    secrets = rotated(
      s,
      await refresh("https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: s.clientKey,
        client_secret: s.clientSecret,
        grant_type: "refresh_token",
        refresh_token: s.refreshToken,
      }),
    );
  }
  const auth = bearer((secrets ?? s).accessToken);
  // Potongan 5-64 MB; potongan terakhir menampung sisanya. Video kecil dikirim utuh.
  const size = video.data.length;
  const chunk = size <= 64 * 1024 * 1024 ? size : 10 * 1024 * 1024;
  const count = Math.max(1, Math.floor(size / chunk));
  const inbox = s.mode === "inbox"; // "inbox": masuk draf TikTok, pemilik menekan posting dari aplikasi
  const init = await call<{ data: { publish_id: string; upload_url: string } }>(
    `https://open.tiktokapis.com/v2/post/publish/${inbox ? "inbox/" : ""}video/init/`,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
          video_size: size,
          chunk_size: chunk,
          total_chunk_count: count,
        },
        ...(inbox
          ? {}
          : {
              post_info: {
                title: post.caption.slice(0, 2200),
                privacy_level: s.privacy || "SELF_ONLY",
              },
            }),
      }),
    },
  );
  for (let i = 0; i < count; i++) {
    const start = i * chunk;
    const end = i === count - 1 ? size : start + chunk;
    const res = await fetch(init.data.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": video.mime,
        "Content-Range": `bytes ${start}-${end - 1}/${size}`,
      },
      body: new Uint8Array(video.data.subarray(start, end)),
    });
    if (!res.ok)
      throw new Error(
        `TikTok menolak potongan ${i + 1}/${count}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
  }
  return { url: null, ref: `tiktok:${init.data.publish_id}`, secrets };
}

// ---------- YouTube ----------

async function publishYouTube(
  s: Secrets,
  post: PublishInput,
): Promise<PublishResult> {
  const video = post.media.find((m) => m.mime.startsWith("video/"));
  if (!video) throw new Error("YouTube: butuh satu berkas video.");
  const t = await refresh("https://oauth2.googleapis.com/token", {
    client_id: s.clientId,
    client_secret: s.clientSecret,
    refresh_token: s.refreshToken,
    grant_type: "refresh_token",
  });
  const auth = bearer(t.access_token);
  const title =
    post.caption.split("\n")[0].replace(/[<>]/g, "").slice(0, 100) ||
    video.name;
  const start = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        ...auth,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": video.mime,
        "X-Upload-Content-Length": String(video.data.length),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description: post.caption.replace(/[<>]/g, "").slice(0, 5000),
        },
        status: { privacyStatus: s.privacy || "private" },
      }),
    },
  );
  const location = start.headers.get("location");
  if (!start.ok || !location)
    throw new Error(
      `YouTube menolak sesi unggah: HTTP ${start.status} ${(await start.text()).slice(0, 300)}`,
    );
  const up = await call<{ id: string }>(location, {
    method: "PUT",
    headers: { ...auth, "Content-Type": video.mime },
    body: new Uint8Array(video.data),
  });
  return { url: `https://youtu.be/${up.id}` };
}

// ---------- Facebook Page ----------

async function publishFacebook(
  s: Secrets,
  post: PublishInput,
): Promise<PublishResult> {
  if (post.media.length > 1)
    throw new Error("Facebook: satu media per posting.");
  const v = s.apiVersion || "v24.0";
  const m = post.media[0];
  if (!m) {
    const r = await call<{ id: string }>(
      `https://graph.facebook.com/${v}/${s.pageId}/feed`,
      {
        method: "POST",
        body: new URLSearchParams({
          message: post.caption,
          access_token: s.accessToken,
        }),
      },
    );
    return { url: `https://www.facebook.com/${r.id}` };
  }
  const video = m.mime.startsWith("video/");
  const fd = new FormData();
  fd.append("access_token", s.accessToken);
  fd.append(video ? "description" : "caption", post.caption);
  fd.append("source", blob(m), m.name);
  const host = video ? "graph-video.facebook.com" : "graph.facebook.com";
  const r = await call<{ id: string; post_id?: string }>(
    `https://${host}/${v}/${s.pageId}/${video ? "videos" : "photos"}`,
    { method: "POST", body: fd },
  );
  return { url: `https://www.facebook.com/${r.post_id ?? r.id}` };
}

// ---------- Telegram (kanal/grup) ----------

async function publishTelegram(
  s: Secrets,
  post: PublishInput,
): Promise<PublishResult> {
  const api = (method: string, body: FormData) =>
    call<{ result: { message_id: number } }>(
      `https://api.telegram.org/bot${s.botToken}/${method}`,
      { method: "POST", body },
    );
  let first: number | null = null;
  if (!post.media.length) {
    const fd = new FormData();
    fd.append("chat_id", s.chatId);
    fd.append("text", post.caption);
    first = (await api("sendMessage", fd)).result.message_id;
  }
  for (const [i, m] of post.media.entries()) {
    const [method, field] =
      m.mime.startsWith("image/") && m.mime !== "image/gif"
        ? ["sendPhoto", "photo"]
        : m.mime.startsWith("video/")
          ? ["sendVideo", "video"]
          : m.mime.startsWith("audio/")
            ? ["sendAudio", "audio"]
            : ["sendDocument", "document"];
    const fd = new FormData();
    fd.append("chat_id", s.chatId);
    if (i === 0 && post.caption)
      fd.append("caption", post.caption.slice(0, 1024));
    fd.append(field, blob(m), m.name);
    const id = (await api(method, fd)).result.message_id;
    first ??= id;
  }
  const url =
    s.chatId.startsWith("@") && first
      ? `https://t.me/${s.chatId.slice(1)}/${first}`
      : null;
  return { url, ref: url ? undefined : `telegram:${first}` };
}

// ---------- Webhook (Instagram, LinkedIn, dll. lewat Make/Zapier/n8n/Buffer) ----------

async function publishWebhook(
  s: Secrets,
  post: PublishInput,
): Promise<PublishResult> {
  const r = await call<{ url?: string }>(s.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(s.secret ? { "X-House-Secret": s.secret } : {}),
    },
    body: JSON.stringify({
      caption: post.caption,
      media: post.media.map((m) => ({
        name: m.name,
        mime: m.mime,
        size: m.data.length,
        base64: m.data.toString("base64"),
      })),
    }),
  });
  return { url: typeof r.url === "string" ? r.url : null, ref: "webhook" };
}

export const PLATFORMS: Record<string, Platform> = {
  x: {
    label: "X (Twitter)",
    hint: "Token OAuth 2.0 pengguna dengan cakupan tweet.write, users.read, media.write, offline.access. Isi refresh token dan client ID agar token diperbarui otomatis.",
    fields: [
      f("accessToken", "Access token"),
      f("refreshToken", "Refresh token", false),
      f("clientId", "Client ID", false, false),
      f("clientSecret", "Client secret", false),
    ],
    publish: publishX,
  },
  tiktok: {
    label: "TikTok",
    hint: "Content Posting API (video.publish atau video.upload). Aplikasi yang belum diaudit TikTok hanya boleh memposting privat (SELF_ONLY). Mode inbox mengirim ke draf.",
    fields: [
      f("accessToken", "Access token"),
      f("refreshToken", "Refresh token", false),
      f("clientKey", "Client key", false, false),
      f("clientSecret", "Client secret", false),
      f(
        "privacy",
        "Privasi (SELF_ONLY, PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR)",
        false,
        false,
      ),
      f("mode", "Mode (direct atau inbox)", false, false),
    ],
    publish: publishTikTok,
  },
  youtube: {
    label: "YouTube",
    hint: "OAuth Google dengan cakupan youtube.upload. Video baru bawaannya privat.",
    fields: [
      f("clientId", "Client ID", true, false),
      f("clientSecret", "Client secret"),
      f("refreshToken", "Refresh token"),
      f("privacy", "Privasi (private, unlisted, public)", false, false),
    ],
    publish: publishYouTube,
  },
  facebook: {
    label: "Facebook Page",
    hint: "Page access token jangka panjang dengan izin pages_manage_posts.",
    fields: [
      f("pageId", "Page ID", true, false),
      f("accessToken", "Page access token"),
      f("apiVersion", "Versi Graph API (mis. v24.0)", false, false),
    ],
    publish: publishFacebook,
  },
  telegram: {
    label: "Telegram",
    hint: "Bot yang sudah menjadi admin kanal. Chat ID berupa @namakanal atau angka.",
    fields: [f("botToken", "Bot token"), f("chatId", "Chat ID", true, false)],
    publish: publishTelegram,
  },
  webhook: {
    label: "Webhook (Instagram, LinkedIn, dll.)",
    hint: "Untuk platform yang butuh URL publik (Instagram) atau alat penjadwal: House mengirim caption dan media (base64) ke URL ini.",
    fields: [
      f("url", "URL webhook", true, false),
      f("secret", "Rahasia (header X-House-Secret)", false),
    ],
    publish: publishWebhook,
  },
};

// Daftar platform untuk formulir di dashboard (tanpa fungsi).
export const platformList = () =>
  Object.entries(PLATFORMS).map(([id, p]) => ({
    id,
    label: p.label,
    hint: p.hint,
    fields: p.fields,
  }));
