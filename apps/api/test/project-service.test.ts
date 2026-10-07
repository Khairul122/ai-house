import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { AuditService } from "../src/modules/audit/audit.service.js";
import { EventBusService } from "../src/modules/events/event-bus.service.js";
import { ProjectService } from "../src/modules/projects/application/project.service.js";
import { TaskService } from "../src/modules/tasks/application/task.service.js";
import { FakeAgentRuntime } from "../src/modules/agents/infrastructure/fake-agent.runtime.js";
import { FileDivisionRepository } from "../src/modules/divisions/infrastructure/file-division.repository.js";
import { migrateDb } from "../src/db/migrate.js";

describe("Project Orchestration Integration Test", () => {
  beforeAll(async () => {
    await migrateDb();
  });

  it("creates project, executes PM planning, and runs task", async () => {
    const auditService = new AuditService();
    const eventBus = new EventBusService();
    const projectService = new ProjectService(auditService, eventBus);
    const taskService = new TaskService(auditService, eventBus);
    const divisionRepo = new FileDivisionRepository("./house/divisions");
    const runtime = new FakeAgentRuntime();

    // 1. Create Project
    const project = await projectService.createProject(
      "Coffee Landing Page",
      "Buat landing page untuk toko kopi lokal"
    );
    expect(project.id).toBeDefined();
    expect(fs.existsSync(project.workspacePath)).toBe(true);

    // 2. Plan Project with PM
    await projectService.planProjectWithPm(project.id, runtime, divisionRepo);

    // Check plan.json created in workspace
    const planFile = path.join(project.workspacePath, "plan.json");
    expect(fs.existsSync(planFile)).toBe(true);

    // 3. Verify Tasks created
    const tasks = await taskService.listProjectTasks(project.id);
    expect(tasks.length).toBe(2);

    // 4. Check executable tasks (first task has no dependencies)
    const executable = await taskService.getExecutableTasks(project.id);
    expect(executable.length).toBe(1);
    expect(executable[0].title).toBe("Desain UI Spec");

    // 5. Run first task
    await taskService.runTask(executable[0].id, runtime, divisionRepo);

    const updatedTasks = await taskService.listProjectTasks(project.id);
    const firstTask = updatedTasks.find((t) => t.id === executable[0].id);
    expect(firstTask?.status).toBe("done");

    // Clean up created test workspace
    fs.rmSync(project.workspacePath, { recursive: true, force: true });
  });
});
