import { sqliteClient } from "./index.js";

export async function migrateDb() {
  await sqliteClient.executeMultiple(`
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS divisions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_hash TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      workspace_path TEXT NOT NULL,
      token_budget INTEGER,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      division_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      done_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempt INTEGER NOT NULL DEFAULT 1,
      result_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id TEXT NOT NULL,
      depends_on_id TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks (id),
      FOREIGN KEY (depends_on_id) REFERENCES tasks (id)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks (id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      risk_level INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      action_summary TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      decided_by TEXT,
      decided_at TEXT,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs (id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (task_id) REFERENCES tasks (id)
    );

    CREATE TABLE IF NOT EXISTS telegram_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      text TEXT NOT NULL,
      project_id TEXT,
      telegram_message_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      event_type TEXT NOT NULL,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
  console.log("Database tables initialized successfully.");
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  migrateDb();
}
