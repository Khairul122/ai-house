import fs from "node:fs";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./data/test-revision.db";
process.env.AUTONOMY = "auto";

const waitFor = async <T>(check: () => Promise<T | undefined | false>, ms = 8000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > end) throw new Error("waktu habis menunggu kondisi");
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe("brief dan revisi", () => {
  it("PM membaca brief; revisi membuat tugas baru di divisi yang sama dan berjalan otomatis", async () => {
    const { migrateDb } = await import("../src/db/migrate.js");
    await migrateDb();
    const { AuditService } = await import("../src/modules/audit/audit.service.js");
    const { EventBusService } = await import("../src/modules/events/event-bus.service.js");
    const { ApprovalService } = await import("../src/modules/approvals/application/approval.service.js");
    const { ProjectService } = await import("../src/modules/projects/application/project.service.js");
    const { TaskService } = await import("../src/modules/tasks/application/task.service.js");
    const { FakeAgentRuntime } = await import("../src/modules/agents/infrastructure/fake-agent.runtime.js");
    const { FileDivisionRepository } = await import("../src/modules/divisions/infrastructure/file-division.repository.js");
    const { OrchestratorService } = await import("../src/modules/orchestrator/orchestrator.service.js");
    const { writeBrief } = await import("../src/modules/projects/application/brief.js");
    const { setAutonomy } = await import("../src/modules/settings/autonomy.js");
    await setAutonomy("auto");

    // runtime tiruan yang mencatat prompt yang diterima tiap divisi
    const prompts: { divisionId: string; prompt: string; description: string }[] = [];
    class RecordingRuntime extends FakeAgentRuntime {
      override async startRun(input: Parameters<FakeAgentRuntime["startRun"]>[0]) {
        prompts.push({ divisionId: input.divisionId, prompt: input.prompt, description: input.taskDescription });
        return super.startRun(input);
      }
    }

    const audit = new AuditService();
    const eventBus = new EventBusService();
    const orchestrator = new OrchestratorService(new RecordingRuntime(), eventBus, audit, new ApprovalService(audit, eventBus), new TaskService(), new FileDivisionRepository());
    orchestrator.listen();

    const project = await new ProjectService(audit, eventBus).createProject("Toko kue", "Landing page pesanan kue");
    writeBrief(project.workspacePath, "# Brief proyek: Toko kue\n\n## Target pengguna\nIbu rumah tangga di Bandung\n", []);
    const status = async () => (await orchestrator.detail(project.id)).project.status;

    await orchestrator.planProject(project.id);
    await waitFor(async () => (await status()) === "completed");
    expect(prompts.find((p) => p.divisionId === "pm")?.prompt).toContain("Ibu rumah tangga di Bandung");
    expect(prompts.find((p) => p.divisionId === "ui-ux-design")?.prompt).toContain("brief/brief.md");

    // revisi tugas desain
    const design = (await orchestrator.detail(project.id)).tasks.find((t) => t.divisionId === "ui-ux-design")!;
    const rev = await orchestrator.reviseTask(design.id, "Warna utama ganti cokelat karamel, tombol pesan lebih besar.");
    expect(rev.title).toBe("Revisi 1: Desain UI Spec");
    expect(rev.divisionId).toBe("ui-ux-design");
    await waitFor(async () => (await status()) === "completed");
    const after = (await orchestrator.detail(project.id)).tasks.find((t) => t.id === rev.id)!;
    expect(after.status).toBe("done");
    const sent = prompts.filter((p) => p.divisionId === "ui-ux-design").at(-1)!;
    expect(sent.description).toContain("cokelat karamel");
    expect(sent.description).toContain("Hasil sebelumnya");

    // revisi kedua dari revisi pertama tetap bernomor berurutan
    const rev2 = await orchestrator.reviseTask(rev.id, "Tambahkan foto produk di hero.");
    expect(rev2.title).toBe("Revisi 2: Desain UI Spec");
    await waitFor(async () => (await status()) === "completed");

    // aturan: catatan wajib, rencana PM tidak direvisi lewat sini
    await expect(orchestrator.reviseTask(design.id, " ")).rejects.toThrow(/catatan revisi/);
    const plan = (await orchestrator.detail(project.id)).tasks.find((t) => t.divisionId === "pm")!;
    await expect(orchestrator.reviseTask(plan.id, "Ubah rencana")).rejects.toThrow(/Rencana PM/);

    fs.rmSync(project.workspacePath, { recursive: true, force: true });
  });
});
