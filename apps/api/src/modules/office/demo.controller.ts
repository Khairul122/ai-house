import { ConflictException, ForbiddenException, Controller, Inject, Post } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../db/index.js";
import { approvals, runs, tasks } from "../../db/schema/index.js";
import { AuditService } from "../audit/audit.service.js";
import { type DivisionEntity, FileDivisionRepository } from "../divisions/infrastructure/file-division.repository.js";
import { EventBusService } from "../events/event-bus.service.js";
import { PLAN_TASK_TITLE } from "../orchestrator/orchestrator.service.js";
import { ProjectService } from "../projects/application/project.service.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DemoStep {
  divisionId: string;
  title: string;
  workMs: number;
  approval?: string;
  fails?: boolean;
}

const shuffle = <T>(list: T[]) => list.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const clean = (text: string) => text.trim().replace(/[.\s]+$/, "");

// Skenario demo dibangun dari divisi yang benar-benar ada: koordinator merencanakan, sampai enam divisi
// anggota acak bekerja sesuai deskripsinya, satu divisi yang punya aturan bash "ask" meminta izin
// untuk perintah pertamanya, dan satu divisi lain gagal.
export function buildDemoPlan(divisions: DivisionEntity[]): DemoStep[] {
  const members = shuffle(divisions.filter((d) => d.role !== "coordinator")).slice(0, 6);
  const asker = members.find((d) => d.permission.bash.ask.length > 0);
  const failer = members.length >= 3 ? members.find((d) => d !== asker) : undefined;
  return members.map((d) => ({
    divisionId: d.id,
    title: clean(d.description) || d.name,
    workMs: between(6000, 14000),
    approval: d === asker ? clean(d.permission.bash.ask[0].replace(/\*/g, "")) : undefined,
    fails: d === failer
  }));
}

@Controller("api/dev")
export class DemoController {
  constructor(
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(EventBusService) private readonly eventBus: EventBusService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(FileDivisionRepository) private readonly divisions: FileDivisionRepository
  ) {}

  @Post("simulate")
  async simulate() {
    if (process.env.NODE_ENV === "production") throw new ForbiddenException("Demo dimatikan di production.");
    const coordinator = this.divisions.coordinator();
    if (!coordinator) throw new ConflictException("Belum ada divisi di house/divisions untuk menjalankan demo.");
    const plan = buildDemoPlan(this.divisions.loadAll());
    const names = plan.map((s) => this.divisions.loadById(s.divisionId)?.name ?? s.divisionId);
    const project = await this.projectService.createProject(
      `Demo: ${plan.length} divisi bekerja`,
      `Simulasi alur kerja dengan ${names.join(", ") || "koordinator saja"}`,
      undefined,
      { demo: true }
    );
    void this.run(project.id, coordinator.id, plan).catch((e) => console.error("Demo gagal", e));
    return { ok: true, projectId: project.id };
  }

  private async run(projectId: string, coordinatorId: string, plan: DemoStep[]) {
    const pmTask = await this.addTask(projectId, coordinatorId, PLAN_TASK_TITLE);
    await this.setStatus(pmTask, "running");
    await sleep(4000);
    await this.setStatus(pmTask, "done");

    const jobs: Promise<void>[] = [];
    for (const step of plan) {
      const t = await this.addTask(projectId, step.divisionId, step.title);
      this.eventBus.publish("task.dispatched", { taskId: t.id, from: coordinatorId, to: t.divisionId, title: t.title });
      jobs.push(this.work(t, step));
      await sleep(2500);
    }
    await Promise.all(jobs);
  }

  private async work(t: TaskRef, step: DemoStep) {
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
