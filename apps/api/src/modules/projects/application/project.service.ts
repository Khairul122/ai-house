import fs from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../../db/index.js";
import { projects } from "../../../db/schema/index.js";
import { AuditService } from "../../audit/audit.service.js";
import { EventBusService } from "../../events/event-bus.service.js";

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
}
