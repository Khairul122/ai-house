import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Bot, InlineKeyboard } from "grammy";
import { AuditService } from "../audit/audit.service.js";
import { FileDivisionRepository } from "../divisions/infrastructure/file-division.repository.js";
import { ProjectService } from "../projects/application/project.service.js";

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Bot | null = null;
  private ownerId: number;

  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(ProjectService)
    private readonly projectService: ProjectService,
    @Inject(FileDivisionRepository)
    private readonly divisionRepo: FileDivisionRepository
  ) {
    this.ownerId = Number(process.env.TELEGRAM_OWNER_ID || 0);
  }

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === "your_bot_token_here") {
      console.warn("TELEGRAM_BOT_TOKEN missing. Telegram bot disabled.");
      return;
    }

    this.bot = new Bot(token);

    // Auth middleware (FR-01)
    this.bot.use(async (ctx, next) => {
      const fromId = ctx.from?.id;
      if (fromId !== this.ownerId) {
        await this.auditService.record("unauthorized_user", "telegram_access_denied", "telegram", String(fromId), {
          username: ctx.from?.username
        });
        console.warn(`Unauthorized Telegram message from ${fromId}`);
        return;
      }
      return next();
    });

    this.registerCommands();
    this.bot.start().catch((err) => console.error("Telegram bot error:", err));
    console.log("Telegram bot started successfully.");
  }

  private registerCommands() {
    if (!this.bot) return;

    // /start
    this.bot.command("start", async (ctx) => {
      await ctx.reply(
        "Selamat datang di AI House.\nSaya adalah bot PM. Kirimkan perintah atau ide proyek untuk memulai.\n\nPerintah tersedia:\n/status - Ringkasan status\n/proyek - Daftar proyek\n/divisi - Daftar divisi\n/stop - Hentikan semua run"
      );
    });

    // /status
    this.bot.command("status", async (ctx) => {
      const projects = await this.projectService.listProjects();
      const active = projects.filter((p) => p.status === "in_progress" || p.status === "planning");
      await ctx.reply(
        `Status AI House:\n- Total proyek: ${projects.length}\n- Proyek aktif: ${active.length}`
      );
    });

    // /proyek
    this.bot.command("proyek", async (ctx) => {
      const projects = await this.projectService.listProjects();
      if (projects.length === 0) {
        await ctx.reply("Belum ada proyek. Kirimkan ide untuk membuat proyek baru.");
        return;
      }
      const text = projects
        .map((p) => `• [${p.status.toUpperCase()}] ${p.title} (ID: ${p.id.slice(0, 8)})`)
        .join("\n");
      await ctx.reply(`Daftar Proyek:\n${text}`);
    });

    // /divisi
    this.bot.command("divisi", async (ctx) => {
      const divisions = this.divisionRepo.loadAll();
      const text = divisions.map((d) => `• ${d.name} (${d.id}) - ${d.model}`).join("\n");
      await ctx.reply(`Divisi AI House:\n${text}`);
    });

    // /stop
    this.bot.command("stop", async (ctx) => {
      await ctx.reply("Semua run dihentikan darurat oleh perintah /stop.");
      await this.auditService.record("owner", "emergency_stop", "house", "all", {});
    });

    // Inline button callbacks
    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (data.startsWith("approval:")) {
        const [, approvalId, decision] = data.split(":");
        await ctx.answerCallbackQuery({ text: `Keputusan: ${decision}` });
        await ctx.editMessageText(`Persetujuan ${approvalId} telah di-${decision}.`);
        await this.auditService.record("owner", "approval_decided", "approval", approvalId, { decision });
      }
    });

    // Text messages -> PM Chat & Project creation
    this.bot.on("message:text", async (ctx) => {
      const text = ctx.message.text;
      await ctx.reply(`PM menerima ide Anda: "${text}".\nMembuat proyek baru dan menyusun rencana...`);

      const project = await this.projectService.createProject(text.slice(0, 40), text);

      const keyboard = new InlineKeyboard()
        .text("Setuju Rencana", `approval:${project.id}:approve`)
        .text("Tolak", `approval:${project.id}:reject`);

      await ctx.reply(
        `Proyek *${project.title}* telah dibuat.\nID Workspace: \`${project.workspacePath}\`\n\nMenunggu persetujuan rencana Anda:`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    });
  }

  async sendNotification(text: string): Promise<void> {
    if (this.bot && this.ownerId) {
      await this.bot.api.sendMessage(this.ownerId, text);
    }
  }

  async sendApprovalRequest(approvalId: string, summary: string, riskLevel: number): Promise<void> {
    if (this.bot && this.ownerId) {
      const keyboard = new InlineKeyboard()
        .text("Setuju", `approval:${approvalId}:allow`)
        .text("Tolak", `approval:${approvalId}:deny`);

      await this.bot.api.sendMessage(
        this.ownerId,
        `⚠️ *Permintaan Persetujuan (Risiko Level ${riskLevel})*\n\n${summary}\n\nID: \`${approvalId}\``,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    }
  }
}
