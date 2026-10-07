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
  private stream: Promise<void> | null = null;

  constructor(baseUrl = process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    const user = process.env.OPENCODE_SERVER_USERNAME || "opencode";
    this.headers = password ? { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` } : {};
  }

  async startRun(input: StartRunInput): Promise<void> {
    await this.connect();
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

  async respondPermission(runId: string, permissionId: string, decision: "allow" | "deny"): Promise<void> {
    const sessionID = this.sessionOf.get(runId);
    if (!sessionID) return;
    await this.api("POST", `/api/session/${sessionID}/permission/${permissionId}/reply`, {
      reply: decision === "allow" ? "once" : "reject"
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
    const ev = JSON.parse(raw) as { type: string; data?: any; properties?: any };
    const d = ev.data ?? ev.properties ?? {};
    const sessionID: string | undefined = d.sessionID ?? d.part?.sessionID;
    const runId = sessionID ? this.runOf.get(sessionID) : undefined;
    if (!sessionID || !runId) return;

    switch (ev.type) {
      case "permission.asked":
        this.busy.add(sessionID);
        await this.emit(runId, { type: "permission", permissionId: d.id, permission: d.permission, patterns: d.patterns ?? [] });
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

// Ambil teks balasan asisten terakhir dari daftar pesan, apa pun bentuk persisnya.
export function lastAssistantText(messages: unknown): string {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i] as any;
    const role = m?.role ?? m?.type ?? m?.info?.role;
    if (role !== "assistant") continue;
    const texts: string[] = [];
    collectText(m, texts);
    const text = texts.join("\n").trim();
    if (text) return text;
  }
  return "";
}

function collectText(node: unknown, out: string[]) {
  if (Array.isArray(node)) {
    for (const n of node) collectText(n, out);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.type === "text" && typeof o.text === "string") out.push(o.text);
    else for (const v of Object.values(o)) collectText(v, out);
  }
}
