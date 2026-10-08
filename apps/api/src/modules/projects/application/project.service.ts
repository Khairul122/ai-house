import fs from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../../db/index.js";
import { projects } from "../../../db/schema/index.js";
import { AuditService } from "../../audit/audit.service.js";
import { EventBusService } from "../../events/event-bus.service.js";

// Proyek nyata disimpan di WORKSPACES_DIR (mis. D:\real-aihouse) dengan nama folder yang mudah dikenali.
// Proyek demo tetap di folder internal agar tidak bercampur dengan hasil kerja sungguhan.
export function workspaceFor(id: string, title: string, demo = false) {
  const base = !demo && process.env.WORKSPACES_DIR ? path.resolve(process.env.WORKSPACES_DIR) : path.resolve("./workspaces");
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return path.join(base, `${slug || "proyek"}-${id.slice(-6).toLowerCase()}`);
}

@Injectable()
export class ProjectService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(EventBusService)
    private readonly eventBus: EventBusService
  ) {}

  async createProject(title: string, goal: string, tokenBudget?: number, options: { demo?: boolean } = {}) {
    const id = ulid();
    const workspacePath = workspaceFor(id, title, options.demo);

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
