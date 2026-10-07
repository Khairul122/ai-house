import fs from "node:fs";
import path from "node:path";
import type { AgentRuntime, RunEvent, StartRunInput } from "../domain/agent-runtime.port.js";

export class FakeAgentRuntime implements AgentRuntime {
  private callbacks = new Map<string, (event: RunEvent) => Promise<void> | void>();

  async startRun(input: StartRunInput): Promise<void> {
    const cb = this.callbacks.get(input.runId);

    if (cb) {
      await cb({ type: "text", content: `Memulai tugas ${input.taskTitle}...` });
    }

    // Ensure workspace path exists
    if (!fs.existsSync(input.workspacePath)) {
      fs.mkdirSync(input.workspacePath, { recursive: true });
    }

    // Produce mock outputs based on division
    if (input.divisionId === "pm") {
      const mockPlan = {
        title: input.taskTitle,
        goal: input.taskDescription,
        tasks: [
          {
            title: "Desain UI Spec",
            divisionId: "ui-ux-design",
            description: "Buat wireframe dan spesifikasi landing page",
            doneCriteria: "Ada spec.md di folder design",
            dependsOnTitles: []
          },
          {
            title: "Implementasi Landing Page",
            divisionId: "software-development",
            description: "Buat komponen HTML/CSS/JS",
            doneCriteria: "Tersedia index.html dan styles.css",
            dependsOnTitles: ["Desain UI Spec"]
          }
        ]
      };
      fs.writeFileSync(path.join(input.workspacePath, "plan.json"), JSON.stringify(mockPlan, null, 2));
    } else {
      const reportsDir = path.join(input.workspacePath, "reports");
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(reportsDir, `${input.taskId}.md`),
        `# Laporan Tugas: ${input.taskTitle}\n\nTugas berhasil dijalankan oleh divisi ${input.divisionId}.`
      );
    }

    if (cb) {
      await cb({ type: "usage", tokensIn: 150, tokensOut: 300 });
      await cb({ type: "done", summary: `Tugas ${input.taskTitle} berhasil diselesaikan.` });
    }
  }

  async cancelRun(runId: string): Promise<void> {
    const cb = this.callbacks.get(runId);
    if (cb) {
      cb({ type: "error", message: "Run dibatalkan pengguna." });
    }
  }

  async respondPermission(_runId: string, _permissionId: string, _decision: "allow" | "deny"): Promise<void> {}

  onEvent(runId: string, callback: (event: RunEvent) => void): void {
    this.callbacks.set(runId, callback);
  }
}
