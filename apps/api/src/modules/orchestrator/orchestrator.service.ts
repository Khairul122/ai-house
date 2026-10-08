import fs from "node:fs";
import path from "node:path";
import { ConflictException, Inject, Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { ProjectPlanSchema } from "@ai-house/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../db/index.js";
import { approvals, auditLog, projects, runs, taskDependencies, tasks } from "../../db/schema/index.js";
import { AGENT_RUNTIME, type AgentRuntime, type RunEvent } from "../agents/domain/agent-runtime.port.js";
import { ApprovalService } from "../approvals/application/approval.service.js";
import { assessPermission } from "../approvals/domain/permission-assessor.js";
import { AuditService } from "../audit/audit.service.js";
import { type DivisionEntity, FileDivisionRepository } from "../divisions/infrastructure/file-division.repository.js";
import { EventBusService } from "../events/event-bus.service.js";
import { getAutonomy } from "../settings/autonomy.js";
import { readBrief } from "../projects/application/brief.js";
import { TaskService } from "../tasks/application/task.service.js";

type Task = typeof tasks.$inferSelect;
type Project = typeof projects.$inferSelect;
type ProjectStatus = "draft" | "planning" | "plan_review" | "in_progress" | "completed" | "failed" | "cancelled";

export const PLAN_TASK_TITLE = "Menyusun rencana proyek";

interface LiveRun {
  taskId: string;
  projectId: string;
  lastActivity: number;
}

// Percobaan maksimum per tugas saat run macet dicoba ulang otomatis.
const MAX_ATTEMPTS = 3;

// Mengatur alur proyek: PM merencanakan, Anda menyetujui rencana, tugas dijalankan
// sesuai ketergantungan dan batas run bersamaan, izin berisiko menunggu keputusan Anda.
@Injectable()
export class OrchestratorService implements OnModuleInit {
  private live = new Map<string, LiveRun>(); // runId
  private waiting = new Map<string, { runId: string; permissionId: string }>(); // approvalId
  private cancelling = new Set<string>(); // runId
  private stalled = new Set<string>(); // runId yang dihentikan pengawas karena tidak ada aktivitas
  private watchdog: ReturnType<typeof setInterval> | null = null;
  // Run tanpa tanda hidup selama ini dianggap macet (mis. model/9router tidak menjawab).
  private readonly idleTimeoutMs = Number(process.env.RUN_IDLE_TIMEOUT_MS) || (Number(process.env.RUN_IDLE_TIMEOUT_MIN) || 8) * 60_000;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly maxRuns = Number(process.env.MAX_CONCURRENT_RUNS) || 2;
  private readonly approvalTimeoutMs = (Number(process.env.APPROVAL_TIMEOUT_MIN) || 30) * 60_000;

  constructor(
    @Inject(AGENT_RUNTIME) private readonly runtime: AgentRuntime,
    @Inject(EventBusService) private readonly eventBus: EventBusService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ApprovalService) private readonly approvals: ApprovalService,
    @Inject(TaskService) private readonly taskService: TaskService,
    @Inject(FileDivisionRepository) private readonly divisions: FileDivisionRepository
  ) {}

  onModuleDestroy() {
    if (this.watchdog) clearInterval(this.watchdog);
  }

  // Pengawas run macet. Run yang sedang menunggu persetujuan pemilik tidak dihitung macet.
  startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => void this.checkStalled(), Math.min(30_000, Math.max(50, this.idleTimeoutMs / 4)));
    this.watchdog.unref?.();
  }

  private async checkStalled() {
    const waitingRuns = new Set([...this.waiting.values()].map((w) => w.runId));
    for (const [runId, run] of this.live) {
      if (waitingRuns.has(runId) || this.stalled.has(runId)) continue;
      if (Date.now() - run.lastActivity < this.idleTimeoutMs) continue;
      this.stalled.add(runId);
      await this.audit.record("pengawas", "run_stalled", "task", run.taskId, { minutes: Math.round(this.idleTimeoutMs / 60000) });
      await this.runtime.cancelRun(runId).catch(() => {});
    }
  }

  async onModuleInit() {
    this.startWatchdog();
    this.listen();
    await this.recoverAfterRestart();
    // Proyek yang sedang berjalan saat server mati dinilai ulang: lanjut, atau ditandai gagal agar bisa dicoba lagi.
    void this.tickAll();
  }

  // Keputusan persetujuan (dari mana pun) diteruskan ke run yang menunggunya.
  listen() {
    return this.eventBus.subscribe((e) => {
      if (e.type === "approval.decided") void this.forwardDecision(e.payload.id, e.payload.decision);
    });
  }

  // Run milik proses server sebelumnya tidak bisa dilanjutkan; tandai agar bisa dicoba lagi.
  async recoverAfterRestart() {
    const now = new Date().toISOString();
    await db
      .update(tasks)
      .set({ status: "failed", resultSummary: "Terhenti karena server dimulai ulang. Coba lagi.", updatedAt: now })
      .where(eq(tasks.status, "running"));
    await db.update(projects).set({ status: "draft", updatedAt: now }).where(eq(projects.status, "planning"));
    await db.update(approvals).set({ status: "expired", decidedBy: "restart", decidedAt: now }).where(eq(approvals.status, "pending"));
  }

  // ---------- baca ----------

  async detail(projectId: string) {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new NotFoundException("Proyek tidak ditemukan.");
    const list = await this.taskService.listProjectTasks(projectId);
    const deps = list.length
      ? await db.query.taskDependencies.findMany({ where: inArray(taskDependencies.taskId, list.map((t) => t.id)) })
      : [];
    return {
      project,
      tasks: list
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((t) => ({ ...t, dependsOn: deps.filter((d) => d.taskId === t.id).map((d) => d.dependsOnId) }))
    };
  }

  // Laporan kerja proyek: apa yang dikerjakan tiap divisi, hasilnya, dan semua aksi berisiko
  // yang dijalankan otomatis atau ditolak, supaya pemilik bisa menilai tanpa ikut menyetujui satu per satu.
  async report(projectId: string) {
    const { project, tasks: list } = await this.detail(projectId);
    const runRows = list.length ? await db.query.runs.findMany({ where: inArray(runs.taskId, list.map((t) => t.id)) }) : [];
    const runTask = new Map(runRows.map((r) => [r.id, r.taskId]));
    const decisions = runRows.length
      ? await db.query.approvals.findMany({ where: inArray(approvals.runId, runRows.map((r) => r.id)) })
      : [];
    const denied = list.length
      ? await db.query.auditLog.findMany({
          where: and(eq(auditLog.eventType, "permission_denied"), inArray(auditLog.subjectId, list.map((t) => t.id)))
        })
      : [];
    const started = runRows.map((r) => r.startedAt).sort()[0] ?? null;
    const ended = runRows.map((r) => r.endedAt).filter((x): x is string => !!x).sort().at(-1) ?? null;
    return {
      project,
      startedAt: started,
      endedAt: project.status === "completed" || project.status === "failed" || project.status === "cancelled" ? ended : null,
      tasks: list.map((t) => ({
        id: t.id,
        divisionId: t.divisionId,
        title: t.title,
        status: t.status,
        attempt: t.attempt,
        summary: t.resultSummary
      })),
      actions: decisions
        .map((a) => ({
          id: a.id,
          taskId: runTask.get(a.runId) ?? null,
          summary: a.actionSummary,
          riskLevel: a.riskLevel,
          status: a.status,
          decidedBy: a.decidedBy,
          at: a.decidedAt ?? a.expiresAt
        }))
        .sort((x, y) => (x.at ?? "").localeCompare(y.at ?? "")),
      denied: denied.map((d) => ({ taskId: d.subjectId, at: d.occurredAt, ...(JSON.parse(d.detailJson) as { summary?: string; reason?: string }) }))
    };
  }

  // Dipanggil saat beralih ke mode otomatis: yang sedang menunggu pemilik langsung dilanjutkan.
  async applyAutonomy() {
    for (const approvalId of [...this.waiting.keys()]) {
      await this.approvals.decide(approvalId, "approved", "otomatis").catch(() => {});
    }
    const reviewing = await db.query.projects.findMany({ where: eq(projects.status, "plan_review") });
    for (const p of reviewing) await this.approvePlan(p.id).catch(() => {});
  }

  // ---------- perencanaan ----------

  async planProject(projectId: string) {
    const project = await this.mustProject(projectId);
    if (project.status !== "draft") throw new ConflictException("Rencana hanya bisa diminta untuk proyek berstatus draf.");
    const pm = this.divisions.loadById("pm");
    if (!pm) throw new ConflictException("Konfigurasi divisi PM tidak ditemukan.");

    await this.setProjectStatus(project, "planning");
    const old = await db.query.tasks.findFirst({
      where: and(eq(tasks.projectId, projectId), eq(tasks.divisionId, "pm"), eq(tasks.title, PLAN_TASK_TITLE))
    });
    const planTask = old
      ? await this.requeue(old)
      : await this.insertTask(projectId, "pm", PLAN_TASK_TITLE, project.goal, "plan.json valid tersimpan di folder kerja");

    const { finished } = await this.launch(planTask, this.planPrompt(project, pm));
    void finished.then((ok) => this.afterPlanning(projectId, planTask.id, ok));
    return { ok: true };
  }

  private planPrompt(project: Project, pm: DivisionEntity) {
    const ids = this.divisions
      .loadAll()
      .filter((d) => d.id !== "pm")
      .map((d) => `- ${d.id}: ${d.description}`)
      .join("\n");
    return `${pm.prompt}

Tujuan proyek "${project.title}": ${project.goal}

${this.briefSection(project)}Pecah tujuan ini menjadi tugas untuk divisi lain. Tulis hasilnya ke berkas plan.json di folder kerja ini, berupa JSON:
{"title": string, "goal": string, "tasks": [{"title": string, "divisionId": string, "description": string, "doneCriteria": string, "dependsOnTitles": string[]}]}
Judul tugas harus unik. dependsOnTitles merujuk judul tugas lain di rencana yang sama.
Jangan bertanya kepada pemilik; tentukan sendiri rencana yang masuk akal.
divisionId wajib salah satu dari:
${ids}`;
  }

  private async afterPlanning(projectId: string, planTaskId: string, ok: boolean) {
    const project = await this.mustProject(projectId);
    if (project.status !== "planning") return; // dihentikan saat merencanakan
    if (!ok) return this.setProjectStatus(project, "draft");

    try {
      const raw = fs.readFileSync(path.join(project.workspacePath, "plan.json"), "utf-8");
      const plan = ProjectPlanSchema.parse(JSON.parse(raw));
      const known = new Set(this.divisions.loadAll().map((d) => d.id));
      const unknown = plan.tasks.filter((t) => !known.has(t.divisionId)).map((t) => t.divisionId);
      if (unknown.length) throw new Error(`divisi tidak dikenal: ${[...new Set(unknown)].join(", ")}`);
      if (!plan.tasks.length) throw new Error("rencana tidak berisi tugas");

      const idByTitle = new Map<string, string>();
      for (const t of plan.tasks) {
        const row = await this.insertTask(projectId, t.divisionId, t.title, t.description, t.doneCriteria);
        idByTitle.set(t.title, row.id);
      }
      for (const t of plan.tasks) {
        for (const dep of t.dependsOnTitles) {
          const parent = idByTitle.get(dep);
          if (parent) await db.insert(taskDependencies).values({ taskId: idByTitle.get(t.title)!, dependsOnId: parent });
        }
      }
      await this.audit.record("pm", "project_planned", "project", projectId, { title: project.title, taskCount: plan.tasks.length });
      if ((await getAutonomy()) === "auto") {
        await this.audit.record("otomatis", "plan_approved", "project", projectId, { title: project.title });
        await this.setProjectStatus(project, "in_progress");
        void this.tickAll();
      } else {
        await this.setProjectStatus(project, "plan_review");
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      await this.finishTask(planTaskId, "failed", `Rencana PM tidak valid: ${reason}`.slice(0, 600));
      await this.setProjectStatus(project, "draft");
    }
  }

  async approvePlan(projectId: string) {
    const project = await this.mustProject(projectId);
    if (project.status !== "plan_review") throw new ConflictException("Tidak ada rencana yang menunggu persetujuan.");
    await this.audit.record("owner", "plan_approved", "project", projectId, { title: project.title });
    await this.setProjectStatus(project, "in_progress");
    void this.tickAll();
    return { ok: true };
  }

  async rejectPlan(projectId: string) {
    const project = await this.mustProject(projectId);
    if (project.status !== "plan_review") throw new ConflictException("Tidak ada rencana yang menunggu persetujuan.");
    const planned = (await this.taskService.listProjectTasks(projectId)).filter((t) => t.title !== PLAN_TASK_TITLE || t.divisionId !== "pm");
    if (planned.length) {
      const ids = planned.map((t) => t.id);
      await db.delete(taskDependencies).where(inArray(taskDependencies.taskId, ids));
      await db.delete(tasks).where(inArray(tasks.id, ids));
    }
    await this.audit.record("owner", "plan_rejected", "project", projectId, { title: project.title });
    await this.setProjectStatus(project, "draft");
    return { ok: true };
  }

  // ---------- eksekusi ----------

  // Diserialkan agar dua pemicu bersamaan tidak memulai tugas yang sama dua kali.
  tickAll(): Promise<unknown> {
    this.queue = this.queue.then(() => this.tick()).catch((e) => console.error("Orkestrator gagal", e));
    return this.queue;
  }

  private async tick() {
    const active = await db.query.projects.findMany({ where: eq(projects.status, "in_progress") });
    for (const project of active) {
      const ready = await this.taskService.getExecutableTasks(project.id);
      for (const t of ready) {
        if (this.live.size >= this.maxRuns) break;
        const division = this.divisions.loadById(t.divisionId);
        this.eventBus.publish("task.dispatched", { taskId: t.id, from: "pm", to: t.divisionId, title: t.title });
        const { finished } = await this.launch(t, this.taskPrompt(t, division, project.workspacePath));
        void finished.then(() => this.tickAll());
      }

      const all = await this.taskService.listProjectTasks(project.id);
      const busy = [...this.live.values()].some((r) => r.projectId === project.id);
      if (busy || ready.length) continue;
      if (all.every((t) => t.status === "done")) {
        await this.audit.record("pm", "project_completed", "project", project.id, { title: project.title });
        await this.setProjectStatus(project, "completed");
      } else if (all.some((t) => t.status === "failed" || t.status === "cancelled")) {
        await this.setProjectStatus(project, "failed");
      }
    }
  }

  // Isi brief langsung dimasukkan ke prompt PM (sudah ringkas); berkas lain dibaca PM sendiri.
  private briefSection(project: Project) {
    const brief = readBrief(project.workspacePath);
    if (!brief) return "";
    return `Brief lengkap dari pemilik (juga tersimpan di brief/brief.md, berkas pendukung di folder brief/):
${brief}

Baca berkas pendukung yang relevan di folder brief/ sebelum menyusun rencana. Bila brief menyebut divisi yang dilibatkan, gunakan hanya divisi tersebut.

`;
  }

  // Revisi: tugas baru untuk divisi yang sama di proyek yang sama, berisi hasil sebelumnya dan catatan pemilik.
  // Agen bekerja di folder yang sama sehingga memperbaiki berkas yang sudah ada, bukan mulai dari nol.
  async reviseTask(taskId: string, note: string) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task) throw new NotFoundException("Tugas tidak ditemukan.");
    const clean = note.trim();
    if (clean.length < 3) throw new ConflictException("Tulis catatan revisi (minimal 3 karakter).");
    if (clean.length > 4000) throw new ConflictException("Catatan revisi terlalu panjang (maksimal 4000 karakter).");
    if (task.status === "running" || task.status === "queued") throw new ConflictException("Tugas ini masih antre atau berjalan. Tunggu selesai dulu.");
    if (task.divisionId === "pm" && task.title === PLAN_TASK_TITLE) {
      throw new ConflictException("Rencana PM tidak direvisi lewat sini. Buat proyek baru atau minta revisi pada tugas divisi.");
    }
    const project = await this.mustProject(task.projectId);
    if (project.status === "planning" || project.status === "plan_review") throw new ConflictException("Proyek sedang direncanakan. Tunggu rencananya selesai.");

    const base = task.title.replace(/^Revisi \d+: /, "");
    const siblings = (await this.taskService.listProjectTasks(project.id)).filter((t) => t.divisionId === task.divisionId && t.title.replace(/^Revisi \d+: /, "") === base);
    const n = siblings.filter((t) => /^Revisi \d+: /.test(t.title)).length + 1;
    const previous = task.resultSummary ? task.resultSummary.slice(0, 1500) : "(tidak ada ringkasan)";
    const revision = await this.insertTask(
      project.id,
      task.divisionId,
      `Revisi ${n}: ${base}`,
      `Revisi atas tugas "${base}" yang sudah dikerjakan di folder ini.\n\nHasil sebelumnya:\n${previous}\n\nPermintaan revisi dari pemilik:\n${clean}\n\nPerbaiki berkas yang sudah ada sesuai permintaan, jangan mulai dari nol kecuali diminta.`,
      "Semua poin permintaan revisi terpenuhi dan dijelaskan di ringkasan."
    );
    await this.audit.record("owner", "revision_requested", "task", revision.id, { title: revision.title, note: clean.slice(0, 300) });
    if (project.status !== "in_progress") await this.setProjectStatus(project, "in_progress");
    void this.tickAll();
    return revision;
  }

  private taskPrompt(t: Task, division: DivisionEntity | null, workspace: string) {
    const brief = fs.existsSync(path.join(workspace, "brief", "brief.md"))
      ? "\nBrief proyek dan berkas perencanaan dari pemilik ada di folder brief/ (mulai dari brief/brief.md); baca yang relevan.\n"
      : "";
    return `${division?.prompt ?? ""}
${brief}
${t.description}
Kriteria selesai: ${t.doneCriteria}
Bekerjalah hanya di dalam folder kerja ini. Akhiri dengan ringkasan singkat hasil kerja.
Aturan saat bekerja di AI House:
- Tidak ada manusia yang memantau selama tugas berjalan. Jangan bertanya; putuskan sendiri dengan pilihan paling aman dan tulis asumsimu di ringkasan akhir.
- Jangan melakukan deployment ke server publik, produksi, atau layanan berbayar. Siapkan konfigurasinya, uji secara lokal, lalu tulis langkah rilis yang tersisa di ringkasan.`;
  }

  // Menandai tugas berjalan (ditunggu), lalu mengembalikan janji selesainya: true bila sukses.
  private async launch(task: Task, prompt: string): Promise<{ finished: Promise<boolean> }> {
    const project = await this.mustProject(task.projectId);
    const division = this.divisions.loadById(task.divisionId);
    if (!division) {
      await this.finishTask(task.id, "failed", `Divisi ${task.divisionId} tidak ditemukan.`);
      return { finished: Promise.resolve(false) };
    }

    const runId = ulid();
    const now = new Date().toISOString();
    await db.insert(runs).values({ id: runId, taskId: task.id, sessionId: runId, status: "running", startedAt: now });
    await db.update(tasks).set({ status: "running", updatedAt: now }).where(eq(tasks.id, task.id));
    this.live.set(runId, { taskId: task.id, projectId: task.projectId, lastActivity: Date.now() });
    this.publishTask(task, "running");

    const finished = new Promise<boolean>((resolve) => {
      const end = async (status: "done" | "failed", summary: string) => {
        if (!this.live.has(runId)) return;
        this.live.delete(runId);
        const cancelled = this.cancelling.delete(runId);
        const stalled = this.stalled.delete(runId);
        if (stalled) {
          summary = `Agen tidak menunjukkan aktivitas selama ${Math.round(this.idleTimeoutMs / 60000)} menit (model kemungkinan tidak menjawab), jadi dihentikan otomatis.`;
        }
        await db.update(runs).set({ status: cancelled ? "cancelled" : status, endedAt: new Date().toISOString(), error: status === "failed" ? summary : null }).where(eq(runs.id, runId));
        await this.finishTask(task.id, cancelled ? "cancelled" : status, summary);
        // Mode otomatis: run macet dicoba ulang sendiri sampai batas percobaan.
        if (stalled && !cancelled && task.attempt < MAX_ATTEMPTS && (await getAutonomy()) === "auto") {
          const fresh = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
          if (fresh?.status === "failed") {
            if (fresh.divisionId === "pm" && fresh.title === PLAN_TASK_TITLE) {
              await this.setProjectStatus(await this.mustProject(task.projectId), "draft");
              void this.planProject(task.projectId).catch(() => {});
            } else await this.requeue(fresh);
          }
        }
        resolve(status === "done" && !cancelled);
      };

      this.runtime.onEvent(runId, async (ev: RunEvent) => {
        const live = this.live.get(runId);
        if (live) live.lastActivity = Date.now();
        if (ev.type === "permission") {
          // Galat saat menilai izin tidak boleh membuat agen menunggu selamanya: tolak saja.
          await this.onPermission(runId, task, division, project.workspacePath, ev).catch(async (e) => {
            console.error("Gagal memproses izin, ditolak:", e);
            await this.runtime.respondPermission(runId, ev.permissionId, "deny").catch(() => {});
          });
        }
        else if (ev.type === "usage") {
          await db.update(runs).set({ tokensIn: ev.tokensIn, tokensOut: ev.tokensOut }).where(eq(runs.id, runId));
          await db.update(projects).set({ tokensUsed: sql`${projects.tokensUsed} + ${ev.tokensIn + ev.tokensOut}` }).where(eq(projects.id, task.projectId));
        } else if (ev.type === "done") await end("done", ev.summary);
        else if (ev.type === "error") await end("failed", ev.message);
      });

      this.runtime
        .startRun({
          runId,
          taskId: task.id,
          divisionId: division.id,
          model: division.model,
          prompt,
          taskTitle: task.title,
          taskDescription: task.description,
          workspacePath: project.workspacePath
        })
        .catch((e: Error) => end("failed", e.message));
    });
    return { finished };
  }

  private async onPermission(runId: string, task: Task, division: DivisionEntity, workspace: string, ev: Extract<RunEvent, { type: "permission" }>) {
    // Alat "question" menunggu jawaban manusia yang tidak pernah datang; ditolak dengan arahan, bukan aksi berisiko.
    if (ev.permission === "question") {
      await this.audit.record(division.id, "question_skipped", "task", task.id, { title: task.title });
      return this.runtime.respondPermission(
        runId,
        ev.permissionId,
        "deny",
        "Tidak ada yang bisa menjawab pertanyaan selama tugas berjalan. Putuskan sendiri dengan pilihan paling aman dan tulis asumsimu di ringkasan."
      );
    }
    const verdict = assessPermission(division.permission, workspace, ev.permission, ev.patterns);
    const summary = ev.permission === "bash" || ev.permission === "shell" ? ev.patterns.join(" && ") : `${ev.permission}: ${ev.patterns.join(", ")}`;

    if (verdict.allowed) return this.runtime.respondPermission(runId, ev.permissionId, "allow");
    if (!verdict.requiresApproval) {
      await this.audit.record(division.id, "permission_denied", "task", task.id, { summary, reason: verdict.reason });
      return this.runtime.respondPermission(runId, ev.permissionId, "deny");
    }

    const id = ulid();
    const auto = (await getAutonomy()) === "auto";
    const now = new Date();
    await db.insert(approvals).values({
      id,
      runId,
      riskLevel: verdict.riskLevel,
      actionType: ev.permission,
      actionSummary: summary,
      payloadJson: JSON.stringify({ permissionId: ev.permissionId, patterns: ev.patterns }),
      expiresAt: new Date(now.getTime() + this.approvalTimeoutMs).toISOString(),
      // mode otomatis: tetap disimpan sebagai persetujuan agar muncul di laporan
      ...(auto ? { status: "approved", decidedBy: "otomatis", decidedAt: now.toISOString() } : {})
    });
    if (auto) {
      await this.audit.record(division.id, "auto_approved", "approval", id, { summary, riskLevel: verdict.riskLevel });
      return this.runtime.respondPermission(runId, ev.permissionId, "allow");
    }
    this.waiting.set(id, { runId, permissionId: ev.permissionId });
    await this.audit.record(division.id, "approval_requested", "approval", id, { summary });
    this.eventBus.publish("approval.created", { id, divisionId: division.id, taskId: task.id, summary, riskLevel: verdict.riskLevel });

    setTimeout(() => {
      if (this.waiting.has(id)) void this.approvals.decide(id, "rejected", "batas-waktu", "expired").catch(() => {});
    }, this.approvalTimeoutMs).unref();
  }

  private async forwardDecision(approvalId: string, decision: "approved" | "rejected") {
    const w = this.waiting.get(approvalId);
    if (!w) return;
    this.waiting.delete(approvalId);
    await this.runtime.respondPermission(w.runId, w.permissionId, decision === "approved" ? "allow" : "deny").catch((e) => console.error(e));
  }

  // ---------- kendali ----------

  async stopProject(projectId: string) {
    const project = await this.mustProject(projectId);
    // Status diubah lebih dulu agar run yang berakhir karena dibatalkan tidak memicu tick menandai "gagal".
    await this.setProjectStatus(project, "cancelled");
    for (const [runId, run] of this.live) {
      if (run.projectId !== projectId) continue;
      this.cancelling.add(runId);
      for (const [approvalId, w] of this.waiting) {
        if (w.runId === runId) await this.approvals.decide(approvalId, "rejected", "owner", "expired").catch(() => {});
      }
      await this.runtime.cancelRun(runId).catch(() => {});
    }
    const queued = (await this.taskService.listProjectTasks(projectId)).filter((t) => t.status === "queued");
    for (const t of queued) await this.finishTask(t.id, "cancelled", "Dihentikan pemilik.");
    await this.audit.record("owner", "project_stopped", "project", projectId, { title: project.title });
    return { ok: true };
  }

  async stopAll() {
    const active = await db.query.projects.findMany({ where: inArray(projects.status, ["planning", "in_progress"]) });
    for (const p of active) await this.stopProject(p.id);
    return { stopped: active.length };
  }

  async retryTask(taskId: string) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task) throw new NotFoundException("Tugas tidak ditemukan.");
    if (task.status !== "failed" && task.status !== "cancelled") throw new ConflictException("Hanya tugas gagal atau dibatalkan yang bisa dicoba lagi.");
    const project = await this.mustProject(task.projectId);

    if (task.divisionId === "pm" && task.title === PLAN_TASK_TITLE) {
      if (project.status !== "draft") await this.setProjectStatus(project, "draft");
      return this.planProject(project.id);
    }
    await this.requeue(task);
    if (project.status !== "in_progress") await this.setProjectStatus(project, "in_progress");
    void this.tickAll();
    return { ok: true };
  }

  // ---------- bantu ----------

  private async mustProject(id: string): Promise<Project> {
    const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (!p) throw new NotFoundException("Proyek tidak ditemukan.");
    return p;
  }

  private async setProjectStatus(project: Project, status: ProjectStatus) {
    await db.update(projects).set({ status, updatedAt: new Date().toISOString() }).where(eq(projects.id, project.id));
    this.eventBus.publish("project.updated", { id: project.id, title: project.title, status });
  }

  private async insertTask(projectId: string, divisionId: string, title: string, description: string, doneCriteria: string) {
    const now = new Date().toISOString();
    const row = { id: ulid(), projectId, divisionId, title, description, doneCriteria, status: "queued", attempt: 1, resultSummary: null, createdAt: now, updatedAt: now };
    await db.insert(tasks).values(row);
    return row as Task;
  }

  private async requeue(task: Task) {
    const next = { status: "queued", attempt: task.attempt + 1, resultSummary: null, updatedAt: new Date().toISOString() };
    await db.update(tasks).set(next).where(eq(tasks.id, task.id));
    return { ...task, ...next } as Task;
  }

  private async finishTask(taskId: string, status: "done" | "failed" | "cancelled", summary: string) {
    await db.update(tasks).set({ status, resultSummary: summary, updatedAt: new Date().toISOString() }).where(eq(tasks.id, taskId));
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task) return;
    this.publishTask(task, status);
    if (status !== "cancelled") await this.audit.record(task.divisionId, `task_${status}`, "task", task.id, { title: task.title });
  }

  private publishTask(task: Task, status: string) {
    this.eventBus.publish("task.updated", { taskId: task.id, divisionId: task.divisionId, title: task.title, status });
  }
}
