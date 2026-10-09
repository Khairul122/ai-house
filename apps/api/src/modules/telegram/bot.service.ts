import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Bot, type Context, InlineKeyboard } from "grammy";
import {
  ApprovalService,
  type Decision,
} from "../approvals/application/approval.service.js";
import { AuditService } from "../audit/audit.service.js";
import { FileDivisionRepository } from "../divisions/infrastructure/file-division.repository.js";
import {
  EventBusService,
  type SystemEvent,
} from "../events/event-bus.service.js";
import { listPendingApprovals } from "../office/office.controller.js";
import {
  OrchestratorService,
  PLAN_TASK_TITLE,
} from "../orchestrator/orchestrator.service.js";
import { ProjectService } from "../projects/application/project.service.js";

const PROJECT_STATUS: Record<string, string> = {
  draft: "draf",
  planning: "direncanakan PM",
  plan_review: "menunggu persetujuan rencana",
  in_progress: "berjalan",
  completed: "selesai",
  failed: "berhenti, ada tugas gagal",
  cancelled: "dihentikan",
};
const TASK_STATUS: Record<string, string> = {
  queued: "antre",
  running: "berjalan",
  done: "selesai",
  failed: "gagal",
  cancelled: "dibatalkan",
};

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private bot: Bot | null = null;
  private readonly ownerId = Number(process.env.TELEGRAM_OWNER_ID || 0);
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(FileDivisionRepository)
    private readonly divisions: FileDivisionRepository,
    @Inject(OrchestratorService)
    private readonly orchestrator: OrchestratorService,
    @Inject(ApprovalService) private readonly approvals: ApprovalService,
    @Inject(EventBusService) private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === "your_bot_token_here" || !this.ownerId) {
      console.warn(
        "TELEGRAM_BOT_TOKEN atau TELEGRAM_OWNER_ID belum diisi. Bot Telegram nonaktif.",
      );
      return;
    }

    this.bot = new Bot(token);
    this.bot.use(async (ctx, next) => {
      if (ctx.from?.id !== this.ownerId) {
        await this.audit.record(
          "unauthorized_user",
          "telegram_access_denied",
          "telegram",
          String(ctx.from?.id),
          {
            username: ctx.from?.username,
          },
        );
        return;
      }
      return next();
    });
    this.bot.catch((err) => console.error("Galat bot Telegram:", err.error));

    this.registerCommands();
    this.unsubscribe = this.eventBus.subscribe(
      (e) =>
        void this.onEvent(e).catch((err) =>
          console.error("Notifikasi Telegram gagal:", err),
        ),
    );
    this.bot
      .start()
      .catch((err) => console.error("Bot Telegram berhenti:", err));
    console.log("Bot Telegram aktif.");
  }

  async onModuleDestroy() {
    this.unsubscribe?.();
    await this.bot?.stop();
  }

  private async send(text: string, keyboard?: InlineKeyboard) {
    if (!this.bot) return;
    // batas Telegram 4096 karakter; pecah di baris
    const chunks: string[] = [];
    let current = "";
    for (const line of text.split("\n")) {
      if ((current + line).length > 3900) {
        chunks.push(current);
        current = "";
      }
      current += `${line}\n`;
    }
    chunks.push(current);
    for (const [i, chunk] of chunks.entries()) {
      await this.bot.api.sendMessage(
        this.ownerId,
        chunk.trim(),
        i === chunks.length - 1 && keyboard ? { reply_markup: keyboard } : {},
      );
    }
  }

  private divisionName(id: string | null | undefined) {
    return (id && this.divisions.loadById(id)?.name) || id || "Divisi";
  }

  private async onEvent(e: SystemEvent) {
    if (e.type === "approval.created") {
      const p = e.payload as {
        id: string;
        divisionId: string;
        summary: string;
        riskLevel: number;
      };
      await this.send(
        `${this.divisionName(p.divisionId)} meminta izin (risiko level ${p.riskLevel}):\n\n${p.summary}\n\nID: ${p.id.slice(-8)}`,
        new InlineKeyboard()
          .text("Setujui", `approval:${p.id}:approved`)
          .text("Tolak", `approval:${p.id}:rejected`),
      );
      return;
    }
    if (e.type !== "project.updated") return;
    const p = e.payload as { id: string; title: string; status?: string };

    if (p.status === "plan_review") {
      const { tasks } = await this.orchestrator.detail(p.id);
      const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
      const lines = tasks
        .filter(
          (t) =>
            !(
              t.divisionId === this.divisions.coordinatorId() &&
              t.title === PLAN_TASK_TITLE
            ),
        )
        .map((t, i) => {
          const after = t.dependsOn
            .map((id) => titleOf.get(id))
            .filter(Boolean);
          return `${i + 1}. [${this.divisionName(t.divisionId)}] ${t.title}${after.length ? ` (setelah: ${after.join(", ")})` : ""}`;
        });
      await this.send(
        `Rencana ${this.divisionName(this.divisions.coordinatorId())} untuk "${p.title}":\n\n${lines.join("\n")}\n\nSetujui agar divisi mulai bekerja?`,
        new InlineKeyboard()
          .text("Setujui rencana", `plan:${p.id}:approve`)
          .text("Tolak", `plan:${p.id}:reject`),
      );
    } else if (p.status === "completed") {
      const { tasks } = await this.orchestrator.detail(p.id);
      const lines = tasks.map((t) =>
        `- ${this.divisionName(t.divisionId)}: ${t.title}\n  ${t.resultSummary ?? ""}`.trimEnd(),
      );
      await this.send(
        `Laporan ${this.divisionName(this.divisions.coordinatorId())}: proyek "${p.title}" selesai.\n\n${lines.join("\n")}`,
      );
    } else if (p.status === "failed") {
      await this.send(
        `Proyek "${p.title}" berhenti karena ada tugas gagal. Buka dashboard untuk melihat sebabnya dan mencoba lagi.`,
      );
    }
  }

  private async decideFromText(ctx: Context, decision: Decision) {
    const arg = (ctx.match as string | undefined)?.trim() ?? "";
    const pending = await listPendingApprovals();
    const match = arg
      ? pending.filter(
          (a) =>
            a.id.toLowerCase().endsWith(arg.toLowerCase()) ||
            a.id.startsWith(arg),
        )
      : pending;
    if (match.length !== 1) {
      await ctx.reply(
        pending.length
          ? `Sebutkan ID persetujuan. Yang menunggu:\n${pending.map((a) => `${a.id.slice(-8)}  ${a.actionSummary}`).join("\n")}`
          : "Tidak ada persetujuan yang menunggu.",
      );
      return;
    }
    await this.approvals.decide(match[0].id, decision, "telegram");
    await ctx.reply(
      `${decision === "approved" ? "Disetujui" : "Ditolak"}: ${match[0].actionSummary}`,
    );
  }

  private registerCommands() {
    const bot = this.bot;
    if (!bot) return;

    bot.command("start", (ctx) =>
      ctx.reply(
        "AI House. Kirim tujuan proyek sebagai pesan biasa, PM akan menyusun rencananya.\n\n" +
          "/status ringkasan\n/proyek daftar proyek\n/tugas tugas proyek terbaru\n/divisi daftar divisi\n" +
          "/setuju <id> dan /tolak <id> memutuskan izin\n/stop hentikan semua run",
      ),
    );

    bot.command("status", async (ctx) => {
      const all = await this.projects.listProjects();
      const active = all.filter((p) =>
        ["planning", "plan_review", "in_progress"].includes(p.status),
      );
      const pending = await listPendingApprovals();
      await ctx.reply(
        `Proyek aktif: ${active.length} dari ${all.length}\nMenunggu izin Anda: ${pending.length}`,
      );
    });

    bot.command("proyek", async (ctx) => {
      const all = await this.projects.listProjects();
      if (!all.length)
        return ctx.reply(
          "Belum ada proyek. Kirim tujuan proyek untuk memulai.",
        );
      await ctx.reply(
        all
          .slice(0, 20)
          .map((p) => `- ${p.title} (${PROJECT_STATUS[p.status] ?? p.status})`)
          .join("\n"),
      );
    });

    bot.command("tugas", async (ctx) => {
      const latest = (await this.projects.listProjects()).find(
        (p) => p.status !== "draft",
      );
      if (!latest) return ctx.reply("Belum ada proyek yang direncanakan.");
      const { tasks } = await this.orchestrator.detail(latest.id);
      const taskList = tasks
        .map(
          (t) =>
            `- [${TASK_STATUS[t.status] ?? t.status}] ${this.divisionName(t.divisionId)}: ${t.title}`,
        )
        .join("\n");
      await ctx.reply(
        `${latest.title} (${PROJECT_STATUS[latest.status] ?? latest.status}):\n${taskList}`,
      );
    });

    bot.command("divisi", (ctx) =>
      ctx.reply(
        this.divisions
          .loadAll()
          .map((d) => `- ${d.name} (${d.model})`)
          .join("\n"),
      ),
    );
    bot.command("setuju", (ctx) => this.decideFromText(ctx, "approved"));
    bot.command("tolak", (ctx) => this.decideFromText(ctx, "rejected"));

    bot.command("stop", async (ctx) => {
      const { stopped } = await this.orchestrator.stopAll();
      await this.audit.record("owner", "emergency_stop", "house", "all", {
        stopped,
      });
      await ctx.reply(
        stopped
          ? `${stopped} proyek dihentikan.`
          : "Tidak ada proyek yang sedang berjalan.",
      );
    });

    bot.on("callback_query:data", async (ctx) => {
      const [kind, id, action] = ctx.callbackQuery.data.split(":");
      try {
        if (
          kind === "approval" &&
          (action === "approved" || action === "rejected")
        ) {
          await this.approvals.decide(id, action, "telegram");
          await ctx.answerCallbackQuery({
            text: action === "approved" ? "Disetujui" : "Ditolak",
          });
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(
            action === "approved" ? "Izin diberikan." : "Izin ditolak.",
          );
        } else if (
          kind === "plan" &&
          (action === "approve" || action === "reject")
        ) {
          if (action === "approve") await this.orchestrator.approvePlan(id);
          else await this.orchestrator.rejectPlan(id);
          await ctx.answerCallbackQuery({
            text:
              action === "approve" ? "Rencana disetujui" : "Rencana ditolak",
          });
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(
            action === "approve"
              ? "Rencana disetujui. Divisi mulai bekerja."
              : "Rencana ditolak. Proyek kembali ke draf.",
          );
        } else {
          await ctx.answerCallbackQuery({ text: "Tombol tidak dikenal." });
        }
      } catch (err) {
        await ctx.answerCallbackQuery({
          text: err instanceof Error ? err.message : "Gagal memproses.",
        });
      }
    });

    bot.on("message:text", async (ctx) => {
      const goal = ctx.message.text.trim();
      const title = goal.length > 60 ? `${goal.slice(0, 57)}...` : goal;
      const project = await this.projects.createProject(title, goal);
      try {
        await this.orchestrator.planProject(project.id);
        await ctx.reply(
          `PM menerima tujuan Anda dan sedang menyusun rencana untuk "${title}". Rencana akan dikirim ke sini untuk Anda setujui.`,
        );
      } catch (err) {
        await ctx.reply(
          `Proyek dibuat, tapi PM gagal mulai merencanakan: ${err instanceof Error ? err.message : err}`,
        );
      }
    });
  }
}
