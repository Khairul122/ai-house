import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

// Database terpisah agar tes tidak menyentuh data/house.db milik Anda.
// Modul di-import dinamis supaya DATABASE_URL terpasang sebelum koneksi dibuat.
process.env.DATABASE_URL = "file:./data/test-orchestrator.db";
process.env.AUTONOMY = "ask"; // tes alur persetujuan manual; mode otomatis diuji terpisah di bawah

const waitFor = async <T>(
  check: () => Promise<T | undefined | false>,
  ms = 5000,
): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > end) throw new Error("waktu habis menunggu kondisi");
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe("Orkestrasi proyek (runtime tiruan)", () => {
  let mods: {
    db: typeof import("../src/db/index.js");
    orch: typeof import("../src/modules/orchestrator/orchestrator.service.js");
    office: typeof import("../src/modules/office/office.controller.js");
  };
  let services: Awaited<ReturnType<typeof setup>>;

  async function setup() {
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

    const audit = new AuditService();
    const eventBus = new EventBusService();
    const approvals = new ApprovalService(audit, eventBus);
    const runtime = new FakeAgentRuntime({
      askFor: { "software-development": "npm install express" },
      planDivisions: ["ui-ux-design", "software-development"],
    });
    const orchestrator = new mods.orch.OrchestratorService(
      runtime,
      eventBus,
      audit,
      approvals,
      new TaskService(),
      new FileDivisionRepository(),
    );
    orchestrator.listen();
    return {
      orchestrator,
      approvals,
      projects: new ProjectService(audit, eventBus),
    };
  }

  beforeAll(async () => {
    mods = {
      db: await import("../src/db/index.js"),
      orch: await import("../src/modules/orchestrator/orchestrator.service.js"),
      office: await import("../src/modules/office/office.controller.js"),
    };
    services = await setup();
  });

  it("PM merencanakan, rencana disetujui, izin level 3 ditunggu, proyek selesai", async () => {
    const { orchestrator, approvals, projects } = services;
    const project = await projects.createProject(
      "Landing page kedai kopi",
      "Buat landing page untuk kedai kopi lokal",
    );
    const status = async () =>
      (await orchestrator.detail(project.id)).project.status;

    await orchestrator.planProject(project.id);
    await waitFor(async () => (await status()) === "plan_review");

    const planned = (await orchestrator.detail(project.id)).tasks;
    expect(planned.map((t) => t.divisionId)).toEqual([
      "pm",
      "ui-ux-design",
      "software-development",
    ]);
    expect(planned[2].dependsOn).toEqual([planned[1].id]);

    await orchestrator.approvePlan(project.id);

    // Desain jalan dulu; Dev baru mulai setelah desain selesai, lalu meminta izin npm install.
    const approval = await waitFor(async () =>
      (await mods.office.listPendingApprovals()).find(
        (a) => a.divisionId === "software-development",
      ),
    );
    expect(approval.actionSummary).toBe("npm install express");
    expect(approval.riskLevel).toBe(3);
    expect(await status()).toBe("in_progress");

    await approvals.decide(approval.id, "approved", "tes");
    await waitFor(async () => (await status()) === "completed");

    const done = await orchestrator.detail(project.id);
    expect(done.tasks.every((t) => t.status === "done")).toBe(true);
    expect(done.project.tokensUsed).toBeGreaterThan(0);

    fs.rmSync(project.workspacePath, { recursive: true, force: true });
  });

  it("menghentikan proyek membatalkan run dan persetujuan yang menunggu", async () => {
    const { orchestrator, projects } = services;
    const project = await projects.createProject(
      "Uji hentikan",
      "Cek tombol hentikan",
    );
    const status = async () =>
      (await orchestrator.detail(project.id)).project.status;

    await orchestrator.planProject(project.id);
    await waitFor(async () => (await status()) === "plan_review");
    await orchestrator.approvePlan(project.id);
    await waitFor(async () =>
      (await mods.office.listPendingApprovals()).find(
        (a) => a.divisionId === "software-development",
      ),
    );

    await orchestrator.stopProject(project.id);
    await new Promise((r) => setTimeout(r, 100)); // beri waktu tick yang tertunda berjalan

    expect(await status()).toBe("cancelled");
    const dev = (await orchestrator.detail(project.id)).tasks.find(
      (t) => t.divisionId === "software-development",
    );
    expect(dev?.status).toBe("cancelled");
    expect(
      (await mods.office.listPendingApprovals()).filter(
        (a) => a.divisionId === "software-development",
      ),
    ).toHaveLength(0);

    fs.rmSync(project.workspacePath, { recursive: true, force: true });
  });

  it("mode otomatis: tanpa menunggu pemilik, aksi level 3 tercatat di laporan", async () => {
    const { orchestrator, projects } = services;
    const { setAutonomy } = await import("../src/modules/settings/autonomy.js");
    await setAutonomy("auto");
    try {
      const project = await projects.createProject(
        "Otomatis",
        "Uji mode otomatis",
      );
      const status = async () =>
        (await orchestrator.detail(project.id)).project.status;

      await orchestrator.planProject(project.id);
      await waitFor(async () => (await status()) === "completed");
      expect(
        (await mods.office.listPendingApprovals()).filter(
          (a) => a.divisionId === "software-development",
        ),
      ).toHaveLength(0);

      const report = await orchestrator.report(project.id);
      expect(report.tasks.every((t) => t.status === "done")).toBe(true);
      expect(report.actions).toHaveLength(1);
      expect(report.actions[0]).toMatchObject({
        summary: "npm install express",
        status: "approved",
        decidedBy: "otomatis",
        riskLevel: 3,
      });
      expect(report.endedAt).not.toBeNull();
      fs.rmSync(project.workspacePath, { recursive: true, force: true });
    } finally {
      await setAutonomy("ask");
    }
  });

  it("menolak izin menggagalkan tugas, lalu bisa dicoba lagi", async () => {
    const { orchestrator, approvals, projects } = services;
    const project = await projects.createProject(
      "Coba ulang",
      "Uji alur gagal dan coba lagi",
    );
    const status = async () =>
      (await orchestrator.detail(project.id)).project.status;

    await orchestrator.planProject(project.id);
    await waitFor(async () => (await status()) === "plan_review");
    await orchestrator.approvePlan(project.id);

    const first = await waitFor(async () =>
      (await mods.office.listPendingApprovals()).find(
        (a) => a.divisionId === "software-development",
      ),
    );
    await approvals.decide(first.id, "rejected", "tes");
    await waitFor(async () => (await status()) === "failed");

    const failed = (await orchestrator.detail(project.id)).tasks.find(
      (t) => t.status === "failed",
    );
    expect(failed?.divisionId).toBe("software-development");

    await orchestrator.retryTask(failed!.id);
    const second = await waitFor(async () =>
      (await mods.office.listPendingApprovals()).find(
        (a) => a.divisionId === "software-development",
      ),
    );
    await approvals.decide(second.id, "approved", "tes");
    await waitFor(async () => (await status()) === "completed");

    fs.rmSync(project.workspacePath, { recursive: true, force: true });
  });
});
