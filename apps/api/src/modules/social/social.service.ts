import fs from "node:fs";
import path from "node:path";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { projects, socialAccounts, socialPosts, tasks } from "../../db/schema/index.js";
import { AuditService } from "../audit/audit.service.js";
import { EventBusService } from "../events/event-bus.service.js";
import { tiktokFinish, tiktokStart } from "./oauth.js";
import { type Media, mimeOf, PLATFORMS } from "./platforms.js";

const MAX_MEDIA_BYTES = 1024 * 1024 * 1024; // 1 GB per berkas
const REQUEST_DIR = "publikasi";
const DONE_SUFFIX = ".diajukan.json";

export const AccountInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "ID akun: 2-40 huruf kecil, angka, atau tanda hubung."),
  platform: z.string().refine((p) => p in PLATFORMS, "Platform tidak didukung."),
  label: z.string().trim().min(1, "Nama akun wajib diisi.").max(80),
  handle: z.string().trim().max(80).optional(),
  secrets: z.record(z.string().max(4000)).default({})
});

export const TikTokConnectSchema = z.object({
  clientKey: z.string().trim().min(3, "Isi Client key.").max(100),
  clientSecret: z.string().trim().min(8, "Isi Client secret.").max(200),
  redirectUri: z.string().trim().url("Redirect URI harus berupa alamat lengkap (https://...).").max(500),
  id: AccountInputSchema.shape.id,
  label: AccountInputSchema.shape.label,
  handle: z.string().trim().max(80).optional()
});

// Berkas pengajuan dari agen: publikasi/<nama>.json. "akun" boleh satu id atau daftar id (multi-platform);
// "per_akun" berisi caption khusus per akun (mis. X 280 karakter, TikTok lebih panjang).
const RequestSchema = z.object({
  akun: z.union([z.string(), z.array(z.string()).max(20)]).default(""),
  caption: z.string().max(10000).default(""),
  per_akun: z.record(z.string().max(10000)).default({}),
  media: z.array(z.string()).max(10).default([])
});

export const PostInputSchema = z.object({
  projectId: z.string(),
  accountId: z.string().nullable().optional(),
  accountIds: z.array(z.string()).max(20).optional(), // satu antrean per akun
  caption: z.string().max(10000).default(""),
  media: z.array(z.string()).max(10).default([])
});

// Daftar akun unik dari isian "akun" (string atau array); kosong = pemilik memilih nanti.
export const accountList = (akun: string | string[]) => [...new Set((Array.isArray(akun) ? akun : [akun]).map((a) => a.trim()).filter(Boolean))];

// Path media relatif terhadap folder kerja dan tidak boleh keluar darinya.
export function resolveMedia(workspace: string, rel: string): string {
  const root = path.resolve(workspace);
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep)) throw new Error(`Media di luar folder kerja: ${rel}`);
  return full;
}

@Injectable()
export class SocialService implements OnModuleInit {
  constructor(
    @Inject(EventBusService) private readonly eventBus: EventBusService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  // Tugas yang selesai diperiksa: pengajuan unggahan di publikasi/*.json dipindah ke antrean tinjauan.
  onModuleInit() {
    this.eventBus.subscribe((e) => {
      if (e.type === "task.updated" && e.payload?.status === "done") void this.collect(e.payload.taskId).catch((err) => console.error("Gagal membaca pengajuan unggahan", err));
    });
  }

  // ---------- akun ----------

  async listAccounts() {
    const rows = await db.query.socialAccounts.findMany({ orderBy: (a, { asc }) => [asc(a.createdAt)] });
    // Token tidak pernah dikirim ke browser; hanya nama kolom yang sudah terisi.
    return rows.map(({ secretJson, ...a }) => ({ ...a, filled: Object.keys(JSON.parse(secretJson) as object) }));
  }

  async addAccount(body: unknown) {
    const parsed = AccountInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Isian akun tidak valid.");
    const input = parsed.data;
    const platform = PLATFORMS[input.platform];
    const secrets = Object.fromEntries(Object.entries(input.secrets).map(([k, v]) => [k, v.trim()]).filter(([k, v]) => v && platform.fields.some((f) => f.key === k)));
    const missing = platform.fields.filter((f) => f.required && !secrets[f.key]).map((f) => f.label);
    if (missing.length) throw new BadRequestException(`${platform.label}: isi ${missing.join(", ")}.`);
    if (await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, input.id) })) throw new ConflictException(`ID akun ${input.id} sudah dipakai.`);
    await db.insert(socialAccounts).values({
      id: input.id,
      platform: input.platform,
      label: input.label,
      handle: input.handle?.replace(/^@/, "") || null,
      secretJson: JSON.stringify(secrets),
      createdAt: new Date().toISOString()
    });
    await this.audit.record("owner", "social_account_added", "social_account", input.id, { platform: input.platform, label: input.label });
    this.changed();
    return { ok: true };
  }

  // Hubungkan TikTok: langkah 1 membuat tautan izin; langkah 2 menukar kode dari alamat pengalihan menjadi token.
  async tiktokConnectStart(body: unknown) {
    const parsed = TikTokConnectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Isian tidak valid.");
    if (await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, parsed.data.id) })) throw new ConflictException(`ID akun ${parsed.data.id} sudah dipakai.`);
    return tiktokStart(parsed.data);
  }

  async tiktokConnectFinish(body: { redirected?: string }) {
    const { pending, tokens } = await tiktokFinish(String(body?.redirected ?? ""));
    await this.addAccount({
      id: pending.id,
      platform: "tiktok",
      label: pending.label,
      handle: pending.handle,
      secrets: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, clientKey: pending.clientKey, clientSecret: pending.clientSecret, privacy: "SELF_ONLY", mode: "inbox" }
    });
    return { ok: true, id: pending.id, scope: tokens.scope };
  }

  async removeAccount(id: string) {
    await db.delete(socialAccounts).where(eq(socialAccounts.id, id));
    await this.audit.record("owner", "social_account_removed", "social_account", id, {});
    this.changed();
    return { ok: true };
  }

  // ---------- pengajuan ----------

  async listPosts(projectId?: string) {
    return db
      .select({
        id: socialPosts.id,
        projectId: socialPosts.projectId,
        projectTitle: projects.title,
        taskId: socialPosts.taskId,
        divisionId: socialPosts.divisionId,
        accountId: socialPosts.accountId,
        caption: socialPosts.caption,
        mediaJson: socialPosts.mediaJson,
        source: socialPosts.source,
        status: socialPosts.status,
        resultUrl: socialPosts.resultUrl,
        error: socialPosts.error,
        createdAt: socialPosts.createdAt,
        updatedAt: socialPosts.updatedAt
      })
      .from(socialPosts)
      .innerJoin(projects, eq(socialPosts.projectId, projects.id))
      .where(projectId ? eq(socialPosts.projectId, projectId) : undefined)
      .orderBy(desc(socialPosts.createdAt))
      .limit(100);
  }

  async collect(taskId: string) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task) return 0;
    const project = await db.query.projects.findFirst({ where: eq(projects.id, task.projectId) });
    const dir = project && path.join(project.workspacePath, REQUEST_DIR);
    if (!project || !dir || !fs.existsSync(dir)) return 0;
    let count = 0;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json") || name.endsWith(DONE_SUFFIX)) continue;
      const file = path.join(dir, name);
      let error: string | null = null;
      let req: z.infer<typeof RequestSchema> = { akun: "", caption: "", per_akun: {}, media: [] };
      try {
        req = RequestSchema.parse(JSON.parse(fs.readFileSync(file, "utf-8")));
        for (const m of req.media) if (!fs.existsSync(resolveMedia(project.workspacePath, m))) throw new Error(`Media tidak ditemukan: ${m}`);
        if (!req.caption.trim() && !Object.keys(req.per_akun).length && !req.media.length) throw new Error("Caption dan media kosong.");
      } catch (e) {
        error = `Pengajuan tidak valid: ${(e as Error).message}`.slice(0, 500);
      }
      // satu pengajuan multi-platform menjadi satu antrean per akun, masing-masing bisa ditinjau sendiri
      const targets = accountList(req.akun);
      for (const akun of targets.length ? targets : [""]) {
        const account = akun ? await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, akun) }) : undefined;
        await this.insertPost({
          projectId: project.id,
          taskId,
          divisionId: task.divisionId,
          accountId: account?.id ?? null,
          caption: req.per_akun[akun] ?? req.caption,
          media: req.media,
          source: `${REQUEST_DIR}/${name}`,
          status: error ? "failed" : "pending",
          error: error ?? (akun && !account ? `Akun "${akun}" belum terdaftar; pilih akun sebelum mengunggah.` : null)
        });
        count++;
      }
      fs.renameSync(file, file.replace(/\.json$/, DONE_SUFFIX));
    }
    if (count) {
      await this.audit.record(task.divisionId, "social_posts_requested", "task", taskId, { count });
      this.changed();
    }
    return count;
  }

  // Pengajuan manual dari pemilik, mis. mengunggah ulang berkas hasil proyek.
  async createPost(body: unknown) {
    const parsed = PostInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Isian unggahan tidak valid.");
    const input = parsed.data;
    const project = await db.query.projects.findFirst({ where: eq(projects.id, input.projectId) });
    if (!project) throw new NotFoundException("Proyek tidak ditemukan.");
    for (const m of input.media) {
      let full: string;
      try {
        full = resolveMedia(project.workspacePath, m);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      if (!fs.existsSync(full)) throw new BadRequestException(`Media tidak ditemukan: ${m}`);
    }
    if (!input.caption.trim() && !input.media.length) throw new BadRequestException("Isi caption atau pilih media.");
    const targets = accountList(input.accountIds ?? (input.accountId ? [input.accountId] : []));
    const ids: string[] = [];
    for (const accountId of targets.length ? targets : [null]) {
      ids.push(await this.insertPost({ projectId: project.id, taskId: null, divisionId: null, accountId, caption: input.caption, media: input.media, source: null, status: "pending", error: null }));
    }
    this.changed();
    return { ids };
  }

  async updatePost(id: string, body: { accountId?: string | null; caption?: string }) {
    const post = await this.mustPost(id);
    if (post.status === "published" || post.status === "publishing") throw new ConflictException("Unggahan ini sudah diproses.");
    if (body.caption !== undefined && body.caption.length > 10000) throw new BadRequestException("Caption terlalu panjang.");
    await db
      .update(socialPosts)
      .set({
        ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        updatedAt: new Date().toISOString()
      })
      .where(eq(socialPosts.id, id));
    this.changed();
    return { ok: true };
  }

  async reject(id: string) {
    const post = await this.mustPost(id);
    if (post.status === "published" || post.status === "publishing") throw new ConflictException("Unggahan ini sudah diproses.");
    await this.setStatus(id, "rejected", {});
    await this.audit.record("owner", "social_post_rejected", "social_post", id, {});
    return { ok: true };
  }

  // Unggah ke platform. Hanya dipicu pemilik: posting publik tidak bisa ditarik kembali.
  async publish(id: string) {
    const post = await this.mustPost(id);
    if (post.status !== "pending" && post.status !== "failed") throw new ConflictException("Hanya unggahan yang menunggu atau gagal yang bisa diunggah.");
    if (!post.accountId) throw new ConflictException("Pilih akun tujuan dulu.");
    const account = await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, post.accountId) });
    if (!account) throw new ConflictException(`Akun ${post.accountId} tidak terdaftar.`);
    const project = await db.query.projects.findFirst({ where: eq(projects.id, post.projectId) });
    if (!project) throw new NotFoundException("Proyek tidak ditemukan.");

    let media: Media[];
    try {
      media = (JSON.parse(post.mediaJson) as string[]).map((rel) => {
        const full = resolveMedia(project.workspacePath, rel);
        if (!fs.existsSync(full)) throw new Error(`Media tidak ditemukan: ${rel}`);
        if (fs.statSync(full).size > MAX_MEDIA_BYTES) throw new Error(`${rel} lebih dari 1 GB.`);
        return { name: path.basename(full), mime: mimeOf(full), data: fs.readFileSync(full) };
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    await this.setStatus(id, "publishing", { error: null });
    // Unggahan video bisa lama; dikerjakan di latar belakang, hasilnya dikirim lewat event.
    void (async () => {
      try {
        const result = await PLATFORMS[account.platform].publish(JSON.parse(account.secretJson), { caption: post.caption, media });
        if (result.secrets) await db.update(socialAccounts).set({ secretJson: JSON.stringify(result.secrets) }).where(eq(socialAccounts.id, account.id));
        await this.setStatus(id, "published", { resultUrl: result.url ?? result.ref ?? null, error: null });
        await this.audit.record("owner", "social_post_published", "social_post", id, { account: account.id, platform: account.platform, url: result.url });
      } catch (e) {
        await this.setStatus(id, "failed", { error: (e as Error).message.slice(0, 1000) });
        await this.audit.record("owner", "social_post_failed", "social_post", id, { account: account.id, error: (e as Error).message.slice(0, 300) });
      }
    })();
    return { ok: true };
  }

  private async insertPost(p: {
    projectId: string;
    taskId: string | null;
    divisionId: string | null;
    accountId: string | null;
    caption: string;
    media: string[];
    source: string | null;
    status: string;
    error: string | null;
  }) {
    const now = new Date().toISOString();
    const id = ulid();
    const { media, ...rest } = p;
    await db.insert(socialPosts).values({ id, ...rest, mediaJson: JSON.stringify(media), resultUrl: null, createdAt: now, updatedAt: now });
    return id;
  }

  private async mustPost(id: string) {
    const post = await db.query.socialPosts.findFirst({ where: eq(socialPosts.id, id) });
    if (!post) throw new NotFoundException("Unggahan tidak ditemukan.");
    return post;
  }

  private async setStatus(id: string, status: string, extra: { resultUrl?: string | null; error?: string | null }) {
    await db.update(socialPosts).set({ status, ...extra, updatedAt: new Date().toISOString() }).where(eq(socialPosts.id, id));
    this.changed();
  }

  private changed() {
    this.eventBus.publish("social.updated", {});
  }
}
