import fs from "node:fs";
import { describe, expect, it } from "vitest";

// DB sendiri dan batas diam sangat pendek agar tes cepat.
process.env.DATABASE_URL = "file:./data/test-watchdog.db";
process.env.AUTONOMY = "auto";
process.env.RUN_IDLE_TIMEOUT_MS = "300";

const waitFor = async <T>(
  check: () => Promise<T | undefined | false>,
  ms = 8000,
): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > end) throw new Error("waktu habis menunggu kondisi");
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe("pengawas run macet", () => {
  it("run yang diam dihentikan, dicoba ulang otomatis, lalu proyek selesai", async () => {
    const { migrateDb } = await import("../src/db/migrate.js");
    await migrateDb();
    const { AuditService } = await import(
      "../src/modules/audit/audit.service.js"
    );
    const { EventBusService } = await import(
      "../src/modules/events/event-bus.service.js"
    );
    const { ApprovalService } = await import(
      "../src/modules/approvals/application/approval.service.js"
    );
    const { ProjectService } = await import(
      "../src/modules/projects/application/project.service.js"
    );
    const { TaskService } = await import(
      "../src/modules/tasks/application/task.service.js"
    );
    const { FakeAgentRuntime } = await import(
      "./support/fake-agent.runtime.js"
    );
    const { FileDivisionRepository } = await import(
      "../src/modules/divisions/infrastructure/file-division.repository.js"
    );
    const { OrchestratorService } = await import(
      "../src/modules/orchestrator/orchestrator.service.js"
    );
    const { setAutonomy } = await import("../src/modules/settings/autonomy.js");
    await setAutonomy("auto");

    // Desain macet pada percobaan pertama: tidak pernah selesai dan tidak ada tanda hidup.
    let hung = false;
    class HangingRuntime extends FakeAgentRuntime {
      override async startRun(
        input: Parameters<FakeAgentRuntime["startRun"]>[0],
      ) {
        if (input.divisionId === "ui-ux-design" && !hung) {
          hung = true;
          return;
        }
        return super.startRun(input);
      }
    }

    const audit = new AuditService();
    const eventBus = new EventBusService();
    const orchestrator = new OrchestratorService(
      new HangingRuntime({
        planDivisions: ["ui-ux-design", "software-development"],
      }),
      eventBus,
      audit,
      new ApprovalService(audit, eventBus),
      new TaskService(),
      new FileDivisionRepository(),
    );
    orchestrator.listen();
    orchestrator.startWatchdog();

    try {
      const project = await new ProjectService(audit, eventBus).createProject(
        "Uji macet",
        "Uji pengawas",
      );
      await orchestrator.planProject(project.id);
      const status = async () =>
        (await orchestrator.detail(project.id)).project.status;
      await waitFor(async () => (await status()) === "completed");

      const design = (await orchestrator.detail(project.id)).tasks.find(
        (t) => t.divisionId === "ui-ux-design",
      )!;
      expect(hung).toBe(true);
      expect(design.status).toBe("done");
      expect(design.attempt).toBe(2);
      fs.rmSync(project.workspacePath, { recursive: true, force: true });
    } finally {
      orchestrator.onModuleDestroy();
    }
  });
});
