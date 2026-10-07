import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../../db/index.js";
import { projects, runs, taskDependencies, tasks } from "../../../db/schema/index.js";
import type { AgentRuntime } from "../../agents/domain/agent-runtime.port.ts";
import { AuditService } from "../../audit/audit.service.js";
import { FileDivisionRepository } from "../../divisions/infrastructure/file-division.repository.js";
import { EventBusService } from "../../events/event-bus.service.js";

@Injectable()
export class TaskService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(EventBusService)
    private readonly eventBus: EventBusService
  ) {}

  async listProjectTasks(projectId: string) {
    return db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId)
    });
  }

  async getExecutableTasks(projectId: string) {
    const allTasks = await this.listProjectTasks(projectId);
    const queuedTasks = allTasks.filter((t) => t.status === "queued");

    const executable: typeof queuedTasks = [];

    for (const t of queuedTasks) {
      // Check dependencies
      const deps = await db.query.taskDependencies.findMany({
        where: eq(taskDependencies.taskId, t.id)
      });

      if (deps.length === 0) {
        executable.push(t);
      } else {
        const parentIds = deps.map((d) => d.dependsOnId);
        const parents = allTasks.filter((p) => parentIds.includes(p.id));
        const allParentsDone = parents.every((p) => p.status === "done");
        if (allParentsDone) {
          executable.push(t);
        }
      }
    }

    return executable;
  }

  async runTask(
    taskId: string,
    runtime: AgentRuntime,
    divisionRepo: FileDivisionRepository
  ) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task) throw new Error("Task not found");

    const project = await db.query.projects.findFirst({ where: eq(projects.id, task.projectId) });
    if (!project) throw new Error("Project not found");

    const division = divisionRepo.loadById(task.divisionId);
    if (!division) throw new Error(`Division ${task.divisionId} not found`);

    const runId = ulid();
    const now = new Date().toISOString();

    await db.insert(runs).values({
      id: runId,
      taskId: task.id,
      sessionId: `session-${runId}`,
      status: "running",
      startedAt: now
    });

    await db.update(tasks).set({ status: "running", updatedAt: now }).where(eq(tasks.id, task.id));
    this.eventBus.publish("task.updated", { taskId: task.id, status: "running" });

    runtime.onEvent(runId, async (event) => {
      this.eventBus.publish("run.event", { runId, event });

      if (event.type === "done") {
        const endedAt = new Date().toISOString();
        await db.update(runs).set({ status: "done", endedAt }).where(eq(runs.id, runId));
        await db.update(tasks).set({
          status: "done",
          resultSummary: event.summary,
          updatedAt: endedAt
        }).where(eq(tasks.id, task.id));

        this.eventBus.publish("task.updated", { taskId: task.id, status: "done" });
        await this.auditService.record(task.divisionId, "task_done", "task", task.id, { summary: event.summary });
      } else if (event.type === "error") {
        const endedAt = new Date().toISOString();
        await db.update(runs).set({ status: "failed", endedAt, error: event.message }).where(eq(runs.id, runId));
        await db.update(tasks).set({ status: "failed", updatedAt: endedAt }).where(eq(tasks.id, task.id));

        this.eventBus.publish("task.updated", { taskId: task.id, status: "failed" });
        await this.auditService.record(task.divisionId, "task_failed", "task", task.id, { error: event.message });
      }
    });

    await runtime.startRun({
      runId,
      taskId: task.id,
      divisionId: division.id,
      model: division.model,
      prompt: division.prompt,
      taskTitle: task.title,
      taskDescription: `${task.description}\nKriteria selesai: ${task.doneCriteria}`,
      workspacePath: project.workspacePath
    });
  }
}
