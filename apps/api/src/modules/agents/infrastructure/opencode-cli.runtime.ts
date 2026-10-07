import { spawn, type ChildProcess } from "node:child_process";
import type { AgentRuntime, RunEvent, StartRunInput } from "../domain/agent-runtime.port.js";

export class OpenCodeCliRuntime implements AgentRuntime {
  private processes = new Map<string, ChildProcess>();
  private callbacks = new Map<string, (event: RunEvent) => void>();

  async startRun(input: StartRunInput): Promise<void> {
    const cb = this.callbacks.get(input.runId);

    // Command: opencode run -m <model> --prompt "<prompt>" in workspacePath
    const child = spawn(
      "opencode",
      ["run", "-m", input.model, "--prompt", `${input.prompt}\n\nTugas: ${input.taskTitle}\n${input.taskDescription}`],
      {
        cwd: input.workspacePath,
        shell: true,
        env: {
          ...process.env,
          NINEROUTER_BASE_URL: process.env.NINEROUTER_BASE_URL || "http://localhost:20128/v1"
        }
      }
    );

    this.processes.set(input.runId, child);

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      if (cb) cb({ type: "text", content: text });
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      if (cb) cb({ type: "text", content: `[stderr] ${text}` });
    });

    child.on("close", (code) => {
      this.processes.delete(input.runId);
      if (cb) {
        if (code === 0) {
          cb({ type: "done", summary: `Tugas ${input.taskTitle} selesai.` });
        } else {
          cb({ type: "error", message: `Eksekusi selesai dengan kode error ${code}.` });
        }
      }
    });

    child.on("error", (err) => {
      this.processes.delete(input.runId);
      if (cb) cb({ type: "error", message: err.message });
    });
  }

  async cancelRun(runId: string): Promise<void> {
    const child = this.processes.get(runId);
    if (child) {
      child.kill("SIGTERM");
      this.processes.delete(runId);
    }
  }

  async respondPermission(_runId: string, _permissionId: string, _decision: "allow" | "deny"): Promise<void> {
    // OpenCode CLI non-interactive mode fallback
  }

  onEvent(runId: string, callback: (event: RunEvent) => void): void {
    this.callbacks.set(runId, callback);
  }
}
