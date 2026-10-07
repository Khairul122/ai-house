import fs from "node:fs";
import path from "node:path";
import type { AgentRuntime, RunEvent, StartRunInput } from "../domain/agent-runtime.port.js";

// Runtime tiruan untuk tes dan pengembangan tanpa model. Divisi di `askFor` meminta izin
// menjalankan perintah bash dan baru selesai setelah izin dijawab.
export class FakeAgentRuntime implements AgentRuntime {
  private callbacks = new Map<string, (event: RunEvent) => Promise<void> | void>();
  private pending = new Map<string, () => Promise<void>>();

  constructor(private readonly options: { askFor?: Record<string, string> } = {}) {}

  async startRun(input: StartRunInput): Promise<void> {
    const emit = async (e: RunEvent) => {
      await this.callbacks.get(input.runId)?.(e);
    };

    await emit({ type: "text", content: `Memulai tugas ${input.taskTitle}...` });
    fs.mkdirSync(input.workspacePath, { recursive: true });

    if (input.divisionId === "pm") {
      const plan = {
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
      fs.writeFileSync(path.join(input.workspacePath, "plan.json"), JSON.stringify(plan, null, 2));
    } else {
      const reportsDir = path.join(input.workspacePath, "reports");
      fs.mkdirSync(reportsDir, { recursive: true });
      fs.writeFileSync(
        path.join(reportsDir, `${input.taskId}.md`),
        `# Laporan Tugas: ${input.taskTitle}\n\nTugas dijalankan oleh divisi ${input.divisionId}.`
      );
    }

    const finish = async () => {
      await emit({ type: "usage", tokensIn: 150, tokensOut: 300 });
      await emit({ type: "done", summary: `Tugas ${input.taskTitle} berhasil diselesaikan.` });
    };

    const command = this.options.askFor?.[input.divisionId];
    if (command) {
      const permissionId = `per_${input.runId}`;
      this.pending.set(permissionId, finish);
      await emit({ type: "permission", permissionId, permission: "bash", patterns: [command] });
      return;
    }
    await finish();
  }

  async cancelRun(runId: string): Promise<void> {
    await this.callbacks.get(runId)?.({ type: "error", message: "Run dibatalkan." });
  }

  async respondPermission(runId: string, permissionId: string, decision: "allow" | "deny"): Promise<void> {
    const finish = this.pending.get(permissionId);
    this.pending.delete(permissionId);
    if (!finish) return;
    if (decision === "allow") await finish();
    else await this.callbacks.get(runId)?.({ type: "error", message: "Izin ditolak, tugas dihentikan." });
  }

  onEvent(runId: string, callback: (event: RunEvent) => Promise<void> | void): void {
    this.callbacks.set(runId, callback);
  }
}
