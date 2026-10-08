import fs from "node:fs";
import path from "node:path";
import { sqliteClient } from "./index.js";

// Proyek dari tombol "Jalankan demo" yang sudah dihapus: judul "Demo: …" dan tujuan "Simulasi alur kerja …".
// Dihapus sekali saat server menyala beserta tugas, run, persetujuan, dan catatan audit terkaitnya.
const DEMO_PROJECTS =
  "SELECT id FROM projects WHERE title LIKE 'Demo:%' AND goal LIKE 'Simulasi alur kerja%'";
const DEMO_TASKS = `SELECT id FROM tasks WHERE project_id IN (${DEMO_PROJECTS})`;
const DEMO_RUNS = `SELECT id FROM runs WHERE task_id IN (${DEMO_TASKS})`;
const DEMO_APPROVALS = `SELECT id FROM approvals WHERE run_id IN (${DEMO_RUNS})`;

export async function purgeDemoData(): Promise<number> {
  const found = await sqliteClient.execute(
    `SELECT id, workspace_path FROM projects WHERE id IN (${DEMO_PROJECTS})`,
  );
  if (!found.rows.length) return 0;

  await sqliteClient.batch(
    [
      `DELETE FROM audit_log WHERE subject_id IN (${DEMO_PROJECTS}) OR subject_id IN (${DEMO_TASKS}) OR subject_id IN (${DEMO_APPROVALS})`,
      `DELETE FROM approvals WHERE id IN (${DEMO_APPROVALS})`,
      `DELETE FROM runs WHERE id IN (${DEMO_RUNS})`,
      `DELETE FROM task_dependencies WHERE task_id IN (${DEMO_TASKS}) OR depends_on_id IN (${DEMO_TASKS})`,
      `DELETE FROM artifacts WHERE project_id IN (${DEMO_PROJECTS})`,
      `DELETE FROM tasks WHERE id IN (${DEMO_TASKS})`,
      `DELETE FROM projects WHERE id IN (${DEMO_PROJECTS})`,
    ],
    "write",
  );

  // Folder demo selalu dibuat di folder internal ./workspaces dengan awalan "demo-".
  const internal = path.resolve("./workspaces");
  for (const row of found.rows) {
    const dir = path.resolve(String(row.workspace_path));
    if (
      path.dirname(dir) === internal &&
      path.basename(dir).startsWith("demo-")
    )
      fs.rmSync(dir, { recursive: true, force: true });
  }
  return found.rows.length;
}
