import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const divisions = sqliteTable("divisions", {
  id: text("id").primaryKey(), // slug
  name: text("name").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash").notNull(),
  configJson: text("config_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true)
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // ulid
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("draft"),
  workspacePath: text("workspace_path").notNull(),
  tokenBudget: integer("token_budget"),
  tokensUsed: integer("tokens_used").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(), // ulid
  projectId: text("project_id").notNull().references(() => projects.id),
  divisionId: text("division_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  doneCriteria: text("done_criteria").notNull(),
  status: text("status").notNull().default("queued"),
  attempt: integer("attempt").notNull().default(1),
  resultSummary: text("result_summary"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const taskDependencies = sqliteTable("task_dependencies", {
  taskId: text("task_id").notNull().references(() => tasks.id),
  dependsOnId: text("depends_on_id").notNull().references(() => tasks.id)
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(), // ulid
  taskId: text("task_id").notNull().references(() => tasks.id),
  sessionId: text("session_id").notNull(),
  status: text("status").notNull().default("running"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  error: text("error")
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(), // ulid
  runId: text("run_id").notNull().references(() => runs.id),
  riskLevel: integer("risk_level").notNull(),
  actionType: text("action_type").notNull(),
  actionSummary: text("action_summary").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: text("decided_at"),
  expiresAt: text("expires_at").notNull()
});

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(), // ulid
  projectId: text("project_id").notNull().references(() => projects.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  path: text("path").notNull(),
  kind: text("kind").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull()
});

export const telegramMessages = sqliteTable("telegram_messages", {
  id: text("id").primaryKey(), // ulid
  chatId: text("chat_id").notNull(),
  direction: text("direction").notNull(), // inbound | outbound
  text: text("text").notNull(),
  projectId: text("project_id"),
  telegramMessageId: integer("telegram_message_id")
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(), // ulid
  actor: text("actor").notNull(),
  eventType: text("event_type").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  detailJson: text("detail_json").notNull(),
  occurredAt: text("occurred_at").notNull()
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull()
});
