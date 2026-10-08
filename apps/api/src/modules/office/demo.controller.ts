import { ForbiddenException, Controller, Inject, Post } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../db/index.js";
import { approvals, runs, tasks } from "../../db/schema/index.js";
import { AuditService } from "../audit/audit.service.js";
import { EventBusService } from "../events/event-bus.service.js";
import { ProjectService } from "../projects/application/project.service.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Skenario demo: PM merencanakan, membagi tugas, divisi bekerja, DevOps minta izin, Cyber gagal.
const PLAN = [
  { divisionId: "ui-ux-design", title: "Wireframe halaman utama", workMs: 9000 },
  { divisionId: "research-content", title: "Riset menu kedai kopi pesaing", workMs: 12000 },
  { divisionId: "software-development", title: "Komponen hero dan daftar menu", workMs: 14000 },
  { divisionId: "devops", title: "Siapkan container rilis", workMs: 5000, approval: "docker-compose up -d di server staging" },
  { divisionId: "cybersecurity", title: "Audit dependensi npm", workMs: 8000, fails: true },
  { divisionId: "qa-testing", title: "Uji tampilan di ponsel", workMs: 10000 }
];

@Controller("api/dev")
export class DemoController {
  constructor(
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(EventBusService) private readonly eventBus: EventBusService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  @Post("simulate")
  async simulate() {
    if (process.env.NODE_ENV === "production") throw new ForbiddenException("Demo dimatikan di production.");
    const project = await this.projectService.createProject("Demo: Landing page kedai kopi", "Simulasi alur kerja kantor", undefined, { demo: true });
    void this.run(project.id).catch((e) => console.error("Demo gagal", e));
    return { ok: true, projectId: project.id };
  }

  private async run(projectId: string) {
    const pmTask = await this.addTask(projectId, "pm", "Menyusun rencana proyek");
    await this.setStatus(pmTask, "running");
    await sleep(4000);
    await this.setStatus(pmTask, "done");

    const jobs: Promise<void>[] = [];
    for (const step of PLAN) {
      const t = await this.addTask(projectId, step.divisionId, step.title);
      this.eventBus.publish("task.dispatched", { taskId: t.id, from: "pm", to: t.divisionId, title: t.title });
      jobs.push(this.work(t, step));
      await sleep(2500);
    }
    await Promise.all(jobs);
  }

  private async work(t: TaskRef, step: (typeof PLAN)[number]) {
    await sleep(4000); // waktu PM berjalan mengantar map tugas
    await this.setStatus(t, "running");
    await sleep(step.workMs);

    if (step.fails) return this.setStatus(t, "failed");

    if (step.approval) {
      const decision = await this.askApproval(t, step.approval);
      if (decision !== "approved") return this.setStatus(t, "failed");
      await sleep(4000);
    }
    await this.setStatus(t, "done");
  }

  private async askApproval(t: TaskRef, summary: string) {
    const runId = ulid();
    const id = ulid();
    const now = new Date();
    await db.insert(runs).values({ id: runId, taskId: t.id, sessionId: `demo-${runId}`, status: "running", startedAt: now.toISOString() });
    await db.insert(approvals).values({
      id,
      runId,
      riskLevel: 3,
      actionType: "bash",
      actionSummary: summary,
      payloadJson: JSON.stringify({ command: summary }),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    });
    this.eventBus.publish("approval.created", { id, divisionId: t.divisionId, taskId: t.id, summary, riskLevel: 3 });
    await this.auditService.record(t.divisionId, "approval_requested", "approval", id, { summary });

    return new Promise<string>((resolve) => {
      const off = this.eventBus.subscribe((e) => {
        if (e.type === "approval.decided" && e.payload.id === id) {
          off();
          resolve(e.payload.decision);
        }
      });
    });
  }

  private async addTask(projectId: string, divisionId: string, title: string): Promise<TaskRef> {
    const id = ulid();
    const now = new Date().toISOString();
    await db.insert(tasks).values({
      id,
      projectId,
      divisionId,
      title,
      description: title,
      doneCriteria: "Selesai",
      status: "queued",
      createdAt: now,
      updatedAt: now
    });
    return { id, divisionId, title };
  }

  private async setStatus(t: TaskRef, status: "running" | "done" | "failed") {
    await db.update(tasks).set({ status, updatedAt: new Date().toISOString() }).where(eq(tasks.id, t.id));
    this.eventBus.publish("task.updated", { taskId: t.id, divisionId: t.divisionId, title: t.title, status });
    if (status !== "running") await this.auditService.record(t.divisionId, `task_${status}`, "task", t.id, { title: t.title });
  }
}

interface TaskRef {
  id: string;
  divisionId: string;
  title: string;
}
