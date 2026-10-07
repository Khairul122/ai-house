import fs from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../../db/index.js";
import { projects, tasks, taskDependencies } from "../../../db/schema/index.js";
import { AuditService } from "../../audit/audit.service.js";
import { EventBusService } from "../../events/event-bus.service.js";
import type { AgentRuntime } from "../../agents/domain/agent-runtime.port.ts";
import { FileDivisionRepository } from "../../divisions/infrastructure/file-division.repository.js";

@Injectable()
export class ProjectService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(EventBusService)
    private readonly eventBus: EventBusService
  ) {}

  async createProject(title: string, goal: string, tokenBudget?: number) {
    const id = ulid();
    const workspacePath = path.resolve("./workspaces", id);

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    const now = new Date().toISOString();
    const newProject = {
      id,
      title,
      goal,
      status: "draft" as const,
      workspacePath,
      tokenBudget: tokenBudget || null,
      tokensUsed: 0,
      createdAt: now,
      updatedAt: now
    };

    await db.insert(projects).values(newProject);
    await this.auditService.record("system", "project_created", "project", id, { title, goal });
    this.eventBus.publish("project.updated", newProject);

    return newProject;
  }

  async getProject(id: string) {
    return db.query.projects.findFirst({
      where: eq(projects.id, id)
    });
  }

  async listProjects() {
    return db.query.projects.findMany({
      orderBy: (p, { desc }) => [desc(p.createdAt)]
    });
  }

  async planProjectWithPm(projectId: string, runtime: AgentRuntime, divisionRepo: FileDivisionRepository) {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const pmDivision = divisionRepo.loadById("pm");
    if (!pmDivision) throw new Error("PM Division config not found");

    const runId = ulid();

    // Mark project as planning
    await db.update(projects).set({ status: "planning", updatedAt: new Date().toISOString() }).where(eq(projects.id, projectId));

    await runtime.startRun({
      runId,
      taskId: "pm-plan",
      divisionId: "pm",
      model: pmDivision.model,
      prompt: pmDivision.prompt,
      taskTitle: `Perencanaan Proyek: ${project.title}`,
      taskDescription: project.goal,
      workspacePath: project.workspacePath
    });

    // Check if plan.json was written by PM
    const planFile = path.join(project.workspacePath, "plan.json");
    if (fs.existsSync(planFile)) {
      const rawPlan = fs.readFileSync(planFile, "utf-8");
      try {
        const parsed = JSON.parse(rawPlan);
        await this.applyPlanToTasks(projectId, parsed.tasks || []);
      } catch (e) {
        console.error("Failed to parse plan.json", e);
      }
    }
  }

  private async applyPlanToTasks(projectId: string, planTasks: any[]) {
    const titleToIdMap = new Map<string, string>();
    const now = new Date().toISOString();

    for (const t of planTasks) {
      const taskId = ulid();
      titleToIdMap.set(t.title, taskId);

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        divisionId: t.divisionId || "software-development",
        title: t.title,
        description: t.description || "",
        doneCriteria: t.doneCriteria || "Selesai",
        status: "queued",
        attempt: 1,
        createdAt: now,
        updatedAt: now
      });
    }

    // Add dependencies
    for (const t of planTasks) {
      const currentTaskId = titleToIdMap.get(t.title);
      if (currentTaskId && Array.isArray(t.dependsOnTitles)) {
        for (const depTitle of t.dependsOnTitles) {
          const parentId = titleToIdMap.get(depTitle);
          if (parentId) {
            await db.insert(taskDependencies).values({
              taskId: currentTaskId,
              dependsOnId: parentId
            });
          }
        }
      }
    }

    // Mark project as ready/in_progress
    await db.update(projects).set({ status: "in_progress", updatedAt: new Date().toISOString() }).where(eq(projects.id, projectId));
    await this.auditService.record("system", "project_planned", "project", projectId, { taskCount: planTasks.length });
  }
}
