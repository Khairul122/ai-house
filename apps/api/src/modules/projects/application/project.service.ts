import fs from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../../../db/index.js";
import { projects } from "../../../db/schema/index.js";
import { AuditService } from "../../audit/audit.service.js";
import { EventBusService } from "../../events/event-bus.service.js";

// Proyek disimpan di WORKSPACES_DIR (mis. D:\real-aihouse) dengan nama folder yang mudah dikenali.
export function workspaceFor(id: string, title: string) {
  const base = process.env.WORKSPACES_DIR
    ? path.resolve(process.env.WORKSPACES_DIR)
    : path.resolve("./workspaces");
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
    private readonly eventBus: EventBusService,
  ) {}

  // `floorId`: proyek untuk satu bidang (lantai); kosong = seluruh gedung. `kind`: "meeting" untuk rapat bidang.
  async createProject(
    title: string,
    goal: string,
    tokenBudget?: number,
    opts: { floorId?: string | null; kind?: "project" | "meeting" } = {},
  ) {
    const id = ulid();
    const workspacePath = workspaceFor(id, title);

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
      floorId: opts.floorId ?? null,
      kind: opts.kind ?? "project",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(projects).values(newProject);
    await this.auditService.record(
      "system",
      newProject.kind === "meeting" ? "meeting_created" : "project_created",
      "project",
      id,
      { title, goal, floorId: newProject.floorId },
    );
    this.eventBus.publish("project.updated", newProject);

    return newProject;
  }

  async getProject(id: string) {
    return db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
  }

  // Rapat terbaru; yang berstatus in_progress dipakai kantor 3D untuk mengumpulkan karakter di ruang rapat.
  async listMeetings() {
    return db.query.projects.findMany({
      where: eq(projects.kind, "meeting"),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit: 30,
    });
  }

  async listProjects() {
    return db.query.projects.findMany({
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }
}
