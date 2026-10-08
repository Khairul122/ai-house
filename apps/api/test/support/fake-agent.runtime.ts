import fs from "node:fs";
import path from "node:path";
import type { AgentRuntime, RunEvent, StartRunInput } from "../../src/modules/agents/domain/agent-runtime.port.js";

// Prompt perencanaan memuat daftar divisi tujuan ("- id: deskripsi") setelah baris penanda ini.
const PLAN_MARKER = "divisionId wajib salah satu dari:";

function planTargets(prompt: string): string[] | null {
  const at = prompt.indexOf(PLAN_MARKER);
  if (at < 0) return null;
  return prompt
    .slice(at + PLAN_MARKER.length)
    .split("\n")
    .map((l) => l.match(/^- ([^:]+):/)?.[1]?.trim())
    .filter((id): id is string => !!id);
}

// Runtime tiruan khusus tes (tidak dipakai aplikasi). Tugas perencanaan dikenali dari prompt-nya,
// jadi rencana selalu memakai divisi yang benar-benar ada. Divisi di `askFor` meminta izin
// menjalankan perintah bash dan baru selesai setelah izin dijawab.
export class FakeAgentRuntime implements AgentRuntime {
  private callbacks = new Map<string, (event: RunEvent) => Promise<void> | void>();
  private pending = new Map<string, () => Promise<void>>();

  constructor(private readonly options: { askFor?: Record<string, string>; planDivisions?: string[] } = {}) {}

  async startRun(input: StartRunInput): Promise<void> {
    const emit = async (e: RunEvent) => {
      await this.callbacks.get(input.runId)?.(e);
    };

    await emit({ type: "text", content: `Memulai tugas ${input.taskTitle}...` });
    fs.mkdirSync(input.workspacePath, { recursive: true });

    const targets = planTargets(input.prompt);
    if (targets) {
      // Rencana tiruan: dua divisi pertama dari daftar di prompt (atau `planDivisions`), yang kedua menunggu yang pertama.
      const ids = (this.options.planDivisions ?? targets).filter((id) => targets.includes(id)).slice(0, 2);
      const plan = {
        title: input.taskTitle,
        goal: input.taskDescription,
        tasks: ids.map((id, i) => ({
          title: `Bagian ${id}`,
          divisionId: id,
          description: `Kerjakan bagian ${id} untuk tujuan: ${input.taskDescription}`,
          doneCriteria: `Ada laporan ${id} di folder reports`,
          dependsOnTitles: i > 0 ? [`Bagian ${ids[i - 1]}`] : []
        }))
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

  async respondPermission(runId: string, permissionId: string, decision: "allow" | "deny", _message?: string): Promise<void> {
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
