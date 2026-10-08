import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./data/test-purge.db";

describe("purgeDemoData", () => {
  it("menghapus proyek demo lama beserta isinya, proyek nyata tetap", async () => {
    const { migrateDb } = await import("../src/db/migrate.js");
    await migrateDb();
    const { sqliteClient } = await import("../src/db/index.js");
    const { purgeDemoData } = await import("../src/db/purge-demo.js");
    const now = new Date().toISOString();
    const project = (id: string, title: string, goal: string) =>
      sqliteClient.execute({
        sql: "INSERT INTO projects (id, title, goal, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [id, title, goal, `/tmp/${id}`, now, now],
      });
    await project(
      "pdemo",
      "Demo: 6 divisi bekerja",
      "Simulasi alur kerja dengan A, B",
    );
    await project("preal", "Demo: aplikasi kasir", "Aplikasi kasir untuk toko");
    await sqliteClient.execute({
      sql: "INSERT INTO tasks (id, project_id, division_id, title, description, done_criteria, created_at, updated_at) VALUES ('tdemo', 'pdemo', 'pm', 'x', 'x', 'x', ?, ?)",
      args: [now, now],
    });
    await sqliteClient.execute({
      sql: "INSERT INTO runs (id, task_id, session_id, started_at) VALUES ('rdemo', 'tdemo', 'demo-1', ?)",
      args: [now],
    });
    await sqliteClient.execute({
      sql: "INSERT INTO approvals (id, run_id, risk_level, action_type, action_summary, payload_json, expires_at) VALUES ('ademo', 'rdemo', 3, 'bash', 'x', '{}', ?)",
      args: [now],
    });
    await sqliteClient.execute({
      sql: "INSERT INTO audit_log (id, actor, event_type, subject_type, subject_id, detail_json, occurred_at) VALUES ('l1', 'pm', 'task_done', 'task', 'tdemo', '{}', ?)",
      args: [now],
    });

    expect(await purgeDemoData()).toBe(1);
    const left = async (table: string) =>
      Number(
        (
          await sqliteClient.execute(
            `SELECT COUNT(*) AS n FROM ${table} WHERE id LIKE '%demo' OR id = 'l1'`,
          )
        ).rows[0].n,
      );
    for (const table of ["projects", "tasks", "runs", "approvals", "audit_log"])
      expect(await left(table), table).toBe(0);
    expect(
      (await sqliteClient.execute("SELECT id FROM projects WHERE id = 'preal'"))
        .rows,
    ).toHaveLength(1);
    expect(await purgeDemoData()).toBe(0);
    await sqliteClient.execute("DELETE FROM projects WHERE id = 'preal'");
  });
});
