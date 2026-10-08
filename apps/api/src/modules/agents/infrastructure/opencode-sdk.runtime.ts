import fs from "node:fs";
import path from "node:path";
import type { AgentRuntime, RunEvent, StartRunInput } from "../domain/agent-runtime.port.js";

type Callback = (event: RunEvent) => Promise<void> | void;

// Runtime ke `opencode serve` (API v2) lewat HTTP + SSE.
// Satu koneksi /api/event dipakai bersama; event dipilah per session ke run yang sesuai.
export class OpenCodeSdkRuntime implements AgentRuntime {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private callbacks = new Map<string, Callback>();
  private sessionOf = new Map<string, string>(); // runId -> sessionID
  private runOf = new Map<string, string>(); // sessionID -> runId
  private busy = new Set<string>(); // session yang sudah mulai bekerja
  private lastBeat = new Map<string, number>(); // runId -> waktu tanda hidup terakhir yang dikirim
  private stream: Promise<void> | null = null;

  constructor(baseUrl = process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    const user = process.env.OPENCODE_SERVER_USERNAME || "opencode";
    this.headers = password ? { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` } : {};
  }

  async startRun(input: StartRunInput): Promise<void> {
    await this.connect();
    writeWorkspaceConfig(input.workspacePath, input.model);
    const [providerID, ...rest] = input.model.split("/");
    const session = await this.api<{ id: string }>("POST", "/api/session", {
      location: { directory: input.workspacePath },
      agent: "build",
      ...(rest.length ? { model: { providerID, id: rest.join("/") } } : {})
    });
    this.sessionOf.set(input.runId, session.id);
    this.runOf.set(session.id, input.runId);
    await this.api("POST", `/api/session/${session.id}/prompt`, {
      text: `${input.prompt}\n\n# Tugas: ${input.taskTitle}\n${input.taskDescription}`
    });
  }

  async cancelRun(runId: string): Promise<void> {
    const sessionID = this.sessionOf.get(runId);
    if (sessionID) await this.api("POST", `/api/session/${sessionID}/interrupt`).catch(() => {});
    await this.emit(runId, { type: "error", message: "Run dihentikan." });
    this.forget(runId);
  }

  async respondPermission(runId: string, permissionId: string, decision: "allow" | "deny", message?: string): Promise<void> {
    const sessionID = this.sessionOf.get(runId);
    if (!sessionID) return;
    await this.api("POST", `/api/session/${sessionID}/permission/${permissionId}/reply`, {
      decision: decision === "allow" ? "once" : "reject",
      ...(message ? { message } : {})
    });
  }

  onEvent(runId: string, callback: Callback): void {
    this.callbacks.set(runId, callback);
  }

  private async emit(runId: string, event: RunEvent) {
    await this.callbacks.get(runId)?.(event);
  }

  private forget(runId: string) {
    const sessionID = this.sessionOf.get(runId);
    if (sessionID) {
      this.runOf.delete(sessionID);
      this.busy.delete(sessionID);
    }
    this.sessionOf.delete(runId);
    this.callbacks.delete(runId);
    this.lastBeat.delete(runId);
  }

  private async api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: { ...this.headers, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new Error(`OpenCode server di ${this.baseUrl} tidak terjangkau. Jalankan \`opencode serve\`.`);
    }
    if (res.status === 401) throw new Error("OpenCode menolak autentikasi. Isi OPENCODE_SERVER_PASSWORD di .env.");
    if (!res.ok) throw new Error(`OpenCode ${method} ${path} gagal (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    if (res.status === 204) return undefined as T;
    const json = (await res.json()) as { data?: T };
    return (json.data ?? json) as T;
  }

  // Resolve saat stream tersambung. Bila putus dan masih ada run aktif, sambung ulang.
  private connect(): Promise<void> {
    if (this.stream) return this.stream;
    this.stream = new Promise<void>((resolve, reject) => {
      void this.listen(resolve).catch((err: Error) => {
        this.stream = null;
        reject(err);
        if (this.runOf.size) setTimeout(() => void this.connect().catch(() => this.failAll(err.message)), 2000);
      });
    });
    return this.stream;
  }

  private async listen(onOpen: () => void) {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/event`, { headers: { ...this.headers, Accept: "text/event-stream" } });
    } catch {
      throw new Error(`OpenCode server di ${this.baseUrl} tidak terjangkau. Jalankan \`opencode serve\`.`);
    }
    if (!res.ok || !res.body) throw new Error(`Stream event OpenCode gagal (HTTP ${res.status}).`);
    onOpen();

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value.replace(/\r\n/g, "\n");
      let cut = buf.indexOf("\n\n");
      while (cut >= 0) {
        const data = buf
          .slice(0, cut)
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        buf = buf.slice(cut + 2);
        if (data) await this.handle(data).catch((e) => console.error("Event OpenCode gagal diproses", e));
        cut = buf.indexOf("\n\n");
      }
    }
    throw new Error("Stream event OpenCode terputus.");
  }

  private async handle(raw: string) {
    const ev = JSON.parse(raw) as { type: string; aggregateID?: string; data?: any; properties?: any };
    const d = ev.data ?? ev.properties ?? {};
    const sessionID: string | undefined = d.sessionID ?? ev.aggregateID ?? d.part?.sessionID;
    const runId = sessionID ? this.runOf.get(sessionID) : undefined;
    if (!sessionID || !runId) return;

    // setiap event dari session berarti agen masih hidup; dikirim paling sering tiap 5 detik
    const now = Date.now();
    if (now - (this.lastBeat.get(runId) ?? 0) > 5000) {
      this.lastBeat.set(runId, now);
      await this.emit(runId, { type: "activity" });
    }

    switch (ev.type) {
      case "question.asked":
        // Tidak ada manusia yang menjawab selama run berjalan: tolak agar agen memutuskan sendiri.
        await this.api("POST", `/api/session/${sessionID}/question/${d.id}/reject`).catch(() => {});
        return;
      case "permission.asked":
        // v2 server: { action, resources }; skema lama: { permission, patterns }
        this.busy.add(sessionID);
        await this.emit(runId, {
          type: "permission",
          permissionId: d.id,
          permission: d.action ?? d.permission ?? "unknown",
          patterns: d.resources ?? d.patterns ?? []
        });
        return;
      case "session.execution.started":
        this.busy.add(sessionID);
        return;
      case "session.execution.succeeded":
        await this.finish(runId, sessionID);
        return;
      case "session.execution.failed":
        await this.emit(runId, { type: "error", message: d.error?.message ?? d.error?.data?.message ?? "Eksekusi OpenCode gagal." });
        this.forget(runId);
        return;
      case "session.execution.interrupted":
        await this.emit(runId, { type: "error", message: "Run dihentikan." });
        this.forget(runId);
        return;
      case "session.error":
        await this.emit(runId, { type: "error", message: d.error?.data?.message ?? d.error?.name ?? "OpenCode melaporkan kesalahan." });
        this.forget(runId);
        return;
      case "session.status":
        if (d.status?.type === "busy") this.busy.add(sessionID);
        else if (d.status?.type === "idle" && this.busy.has(sessionID)) await this.finish(runId, sessionID);
        return;
      case "session.idle":
        if (this.busy.has(sessionID)) await this.finish(runId, sessionID);
        return;
      default:
        if (ev.type.startsWith("message.")) this.busy.add(sessionID);
    }
  }

  private async finish(runId: string, sessionID: string) {
    this.busy.delete(sessionID);
    const session = await this.api<{ tokens?: { input?: number; output?: number } }>("GET", `/api/session/${sessionID}`).catch(() => null);
    if (session?.tokens) {
      await this.emit(runId, { type: "usage", tokensIn: session.tokens.input ?? 0, tokensOut: session.tokens.output ?? 0 });
    }
    const messages = await this.api<unknown>("GET", `/api/session/${sessionID}/message`).catch(() => null);
    const summary = lastAssistantText(messages).slice(0, 800) || "Tugas selesai tanpa ringkasan teks.";
    await this.emit(runId, { type: "done", summary });
    this.forget(runId);
  }

  private async failAll(message: string) {
    for (const runId of [...this.sessionOf.keys()]) {
      await this.emit(runId, { type: "error", message });
      this.forget(runId);
    }
  }
}

// Konfigurasi OpenCode per workspace:
// - mendaftarkan model 9router pilihan divisi (kunci API dibaca OpenCode dari env NINEROUTER_API_KEY),
// - semua aksi "ask", supaya setiap izin lewat penilaian risiko House dan tidak diloloskan
//   oleh aturan "allow" di konfigurasi global OpenCode milik pengguna.
export function writeWorkspaceConfig(workspace: string, model: string) {
  const [providerID, ...rest] = model.split("/");
  const id = rest.join("/");
  const actions = ["*", "shell", "edit", "read", "glob", "grep", "list", "webfetch", "websearch", "external_directory", "skill", "task"];
  const config = {
    $schema: "https://opencode.ai/config.json",
    ...(providerID === "9router" && id
      ? {
          providers: {
            "9router": {
              package: "@opencode/ai/providers/openai-compatible",
              env: ["NINEROUTER_API_KEY"],
              settings: { baseURL: process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:20128/v1" },
              models: { [id]: { modelID: id } }
            }
          }
        }
      : {}),
    permissions: actions.map((action) => ({ action, resource: "*", effect: "ask" }))
  };
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, "opencode.json"), JSON.stringify(config, null, 2));
}

// Teks jawaban langsung asisten yang terakhir. Keluaran alat (isi skill, "Wrote file ...") diabaikan.
export function lastAssistantText(messages: unknown): string {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i] as any;
    if ((m?.role ?? m?.type ?? m?.info?.role) !== "assistant") continue;
    const parts = (m.content ?? m.parts ?? []) as { type?: string; text?: string }[];
    const text = parts
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}
