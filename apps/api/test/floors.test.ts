import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./data/test-floors.db";
process.env.AUTONOMY = "auto";

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

describe("lantai, rapat bidang, dan pengajuan unggahan", () => {
  it("proyek per lantai, rapat dengan notulen, dan publikasi/*.json masuk antrean tinjauan", async () => {
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
    const { SocialService, resolveMedia } = await import(
      "../src/modules/social/social.service.js"
    );
    const { setAutonomy } = await import("../src/modules/settings/autonomy.js");
    await setAutonomy("auto");

    const repo = new FileDivisionRepository();
    const floors = repo.loadFloors();
    expect(floors.map((f) => f.id)).toEqual([
      "software",
      "data-security",
      "content",
    ]);
    const content = floors.find((f) => f.id === "content")!;
    expect(content.leadId).toBe("content-creator");
    expect(content.divisionIds).toEqual([
      "content-creator",
      "visual-design",
      "video-production",
      "copywriting",
      "audio-production",
      "social-media",
    ]);
    // koordinator utama tetap PM; lantai tanpa ketua memakai PM
    expect(repo.coordinatorId()).toBe("pm");
    expect(repo.planner("content")?.id).toBe("content-creator");
    expect(repo.planner("data-security")?.id).toBe("pm");
    expect(floors.flatMap((f) => f.divisionIds).length).toBe(
      repo.loadAll().length,
    );

    const prompts: { divisionId: string; prompt: string }[] = [];
    class RecordingRuntime extends FakeAgentRuntime {
      override async startRun(
        input: Parameters<FakeAgentRuntime["startRun"]>[0],
      ) {
        prompts.push({ divisionId: input.divisionId, prompt: input.prompt });
        return super.startRun(input);
      }
    }
    const audit = new AuditService();
    const eventBus = new EventBusService();
    const orchestrator = new OrchestratorService(
      new RecordingRuntime(),
      eventBus,
      audit,
      new ApprovalService(audit, eventBus),
      new TaskService(),
      repo,
    );
    orchestrator.listen();
    const social = new SocialService(eventBus, audit);
    const projects = new ProjectService(audit, eventBus);

    // 1. proyek untuk lantai content: direncanakan ketua bidang, tugas hanya untuk divisi lantai itu
    const campaign = await projects.createProject(
      "Kampanye kopi",
      "Konten peluncuran kopi susu",
      undefined,
      { floorId: "content" },
    );
    await orchestrator.planProject(campaign.id);
    await waitFor(
      async () =>
        (await orchestrator.detail(campaign.id)).project.status === "completed",
    );
    const campaignTasks = (await orchestrator.detail(campaign.id)).tasks;
    expect(campaignTasks[0].divisionId).toBe("content-creator");
    expect(
      campaignTasks.every((t) => content.divisionIds.includes(t.divisionId)),
    ).toBe(true);
    const planPrompt = prompts.find(
      (p) => p.divisionId === "content-creator",
    )!.prompt;
    expect(planPrompt).toContain("- visual-design:");
    expect(planPrompt).not.toContain("- software-development:");

    // 2. rapat bidang: lima masukan, notulen ketua menunggu semuanya
    const meeting = await projects.createProject(
      "Rapat Content Creator: ide Ramadan",
      "ide Ramadan",
      undefined,
      { floorId: "content", kind: "meeting" },
    );
    await orchestrator.startMeeting(meeting.id, "ide Ramadan");
    await waitFor(
      async () =>
        (await orchestrator.detail(meeting.id)).project.status === "completed",
    );
    const { tasks: meetingTasks } = await orchestrator.detail(meeting.id);
    const notes = meetingTasks.find((t) => t.title === "Notulen rapat")!;
    expect(notes.divisionId).toBe("content-creator");
    expect(meetingTasks.length).toBe(6);
    expect(notes.dependsOn.length).toBe(5);
    expect((await projects.listMeetings())[0].id).toBe(meeting.id);

    // 3. divisi publish mendapat format pengajuan unggahan di prompt tugasnya
    const social1 = prompts.find((p) => p.divisionId === "social-media");
    expect(social1?.prompt).toContain("publikasi/<nama>.json");

    // 4. pengajuan dari agen masuk antrean, berkasnya ditandai sudah diajukan
    const dir = path.join(campaign.workspacePath, "publikasi");
    fs.mkdirSync(path.join(campaign.workspacePath, "konten"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(campaign.workspacePath, "konten", "poster.png"),
      "png",
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "poster.json"),
      JSON.stringify({
        akun: "x-utama",
        caption: "Kopi susu baru!",
        media: ["konten/poster.png"],
      }),
    );
    fs.writeFileSync(
      path.join(dir, "jahat.json"),
      JSON.stringify({ akun: "", caption: "x", media: ["../../rahasia.txt"] }),
    );
    expect(await social.collect(campaignTasks.at(-1)!.id)).toBe(2);
    expect(fs.existsSync(path.join(dir, "poster.diajukan.json"))).toBe(true);
    const posts = await social.listPosts(campaign.id);
    const poster = posts.find((p) => p.caption === "Kopi susu baru!")!;
    expect(poster.status).toBe("pending");
    expect(poster.accountId).toBeNull(); // akun belum terdaftar: pemilik memilih
    expect(posts.find((p) => p.caption === "x")?.status).toBe("failed");
    await expect(social.publish(poster.id)).rejects.toThrow(/Pilih akun/);

    // 5. akun terdaftar; token tidak pernah ikut dikirim
    await social.removeAccount("tg-kanal"); // basis data tes dipakai ulang antar-run
    await expect(
      social.addAccount({
        id: "tg-kanal",
        platform: "telegram",
        label: "Kanal",
        secrets: { botToken: "123:abc" },
      }),
    ).rejects.toThrow(/Chat ID/);
    await social.addAccount({
      id: "tg-kanal",
      platform: "telegram",
      label: "Kanal",
      secrets: { botToken: "123:abc", chatId: "@kopi" },
    });
    const [account] = await social.listAccounts();
    expect(account.filled).toEqual(["botToken", "chatId"]);
    expect(JSON.stringify(account)).not.toContain("123:abc");

    // 6. satu pengajuan multi-platform jadi satu antrean per akun, caption khusus lewat per_akun
    fs.writeFileSync(
      path.join(dir, "multi.json"),
      JSON.stringify({
        akun: ["tg-kanal", "x-belum-ada"],
        caption: "Caption umum",
        per_akun: { "tg-kanal": "Halo Telegram" },
        media: ["konten/poster.png"],
      }),
    );
    expect(await social.collect(campaignTasks.at(-1)!.id)).toBe(2);
    const multi = (await social.listPosts(campaign.id)).filter(
      (p) => p.source === "publikasi/multi.json",
    );
    expect(multi.find((p) => p.accountId === "tg-kanal")?.caption).toBe(
      "Halo Telegram",
    );
    const missing = multi.find((p) => p.accountId === null)!;
    expect(missing.caption).toBe("Caption umum");
    expect(missing.error).toMatch(/x-belum-ada/);
    // pengajuan manual ke banyak akun sekaligus
    expect(
      (
        await social.createPost({
          projectId: campaign.id,
          accountIds: ["tg-kanal", "tg-kanal", "x-lain"],
          caption: "Halo semua",
        })
      ).ids,
    ).toHaveLength(2);

    expect(() => resolveMedia(campaign.workspacePath, "../luar.png")).toThrow(
      /di luar/,
    );

    fs.rmSync(campaign.workspacePath, { recursive: true, force: true });
    fs.rmSync(meeting.workspacePath, { recursive: true, force: true });
  }, 20000);
});
