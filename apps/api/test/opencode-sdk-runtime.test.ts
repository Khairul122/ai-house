import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RunEvent } from "../src/modules/agents/domain/agent-runtime.port.js";
import { OpenCodeSdkRuntime } from "../src/modules/agents/infrastructure/opencode-sdk.runtime.js";

// Server tiruan berbentuk API v2 `opencode serve`: SSE {id,type,data}, izin, lalu idle.
describe("OpenCodeSdkRuntime", () => {
  let server: http.Server;
  let base = "";
  let stream: http.ServerResponse | null = null;
  const seen: { method: string; url: string; body: string; auth?: string }[] = [];
  const push = (type: string, data: unknown) => stream?.write(`data: ${JSON.stringify({ id: "evt", type, data })}\n\n`);

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ method: req.method!, url: req.url!, body, auth: req.headers.authorization });
        const json = (data: unknown) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data }));
        if (req.url === "/api/event") {
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          stream = res;
          push("server.connected", {});
        } else if (req.url === "/api/session" && req.method === "POST") json({ id: "ses_1" });
        else if (req.url === "/api/session/ses_1/prompt") {
          json({ id: "msg_1" });
          // status idle awal (sebelum sibuk) harus diabaikan
          setTimeout(() => {
            push("session.status", { sessionID: "ses_1", status: { type: "idle" } });
            push("session.execution.started", { sessionID: "ses_1" });
            // bentuk asli server v2 (diamati dari opencode serve 2.0.16)
            push("permission.asked", { id: "per_1", sessionID: "ses_1", action: "shell", resources: ["npm install"], save: ["npm install *"], source: { type: "tool" } });
          }, 10);
        } else if (req.url === "/api/session/ses_1/permission/per_1/reply") {
          json({});
          // agen sempat memakai alat pertanyaan; runtime harus menolaknya agar tidak menunggu selamanya
          setTimeout(() => push("question.asked", { id: "que_1", sessionID: "ses_1", questions: [{ question: "Deploy sekarang?", options: [] }] }), 5);
          setTimeout(() => push("session.execution.succeeded", { sessionID: "ses_1" }), 40);
        } else if (req.url === "/api/session/ses_1/question/que_1/reject") json({});
        else if (req.url === "/api/session/ses_1") json({ tokens: { input: 120, output: 45 } });
        else if (req.url === "/api/session/ses_1/message") {
          json([
            { id: "msg_0", text: "Tugas" },
            { id: "msg_1", type: "assistant", content: [{ type: "tool", name: "shell" }, { type: "text", text: "Halaman selesai dibuat." }] }
          ]);
        } else res.writeHead(404).end();
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    stream?.end();
    server.closeAllConnections();
    server.close();
  });

  it("membuat session, meneruskan izin, lalu melapor selesai dengan ringkasan", async () => {
    process.env.OPENCODE_SERVER_PASSWORD = "rahasia";
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "house-ws-"));
    const runtime = new OpenCodeSdkRuntime(base);
    const events: RunEvent[] = [];
    const done = new Promise<void>((resolve) => {
      runtime.onEvent("run_1", async (e) => {
        events.push(e);
        if (e.type === "permission") await runtime.respondPermission("run_1", e.permissionId, "allow");
        if (e.type === "done" || e.type === "error") resolve();
      });
    });

    await runtime.startRun({
      runId: "run_1",
      taskId: "t1",
      divisionId: "software-development",
      model: "9router/default-model",
      prompt: "Kamu divisi Dev.",
      taskTitle: "Buat halaman",
      taskDescription: "index.html",
      workspacePath: ws
    });
    await done;

    expect(events.some((e) => e.type === "activity")).toBe(true); // tanda hidup untuk pengawas run macet
    expect(events.filter((e) => e.type !== "activity")).toEqual([
      { type: "permission", permissionId: "per_1", permission: "shell", patterns: ["npm install"] },
      { type: "usage", tokensIn: 120, tokensOut: 45 },
      { type: "done", summary: "Halaman selesai dibuat." }
    ]);
    const create = JSON.parse(seen.find((s) => s.url === "/api/session" && s.method === "POST")!.body);
    expect(create).toEqual({ location: { directory: ws }, agent: "house", model: { providerID: "9router", id: "default-model" } });

    // workspace mendapat konfigurasi: model terdaftar, semua aksi "ask"
    const cfg = JSON.parse(fs.readFileSync(path.join(ws, "opencode.json"), "utf-8"));
    expect(cfg.providers["9router"].models).toEqual({ "default-model": { modelID: "default-model" } });
    expect(cfg.permissions.every((r: { effect: string }) => r.effect === "ask")).toBe(true);
    expect(cfg.permissions).toEqual([{ action: "*", resource: "*", effect: "ask" }]);
    fs.rmSync(ws, { recursive: true, force: true });
    expect(JSON.parse(seen.find((s) => s.url.endsWith("/reply"))!.body)).toEqual({ decision: "once" });
    expect(seen.some((x) => x.url === "/api/session/ses_1/question/que_1/reject" && x.method === "POST")).toBe(true);
    expect(seen[0].auth).toBe(`Basic ${Buffer.from("opencode:rahasia").toString("base64")}`);
  });
});
