export interface StartRunInput {
  runId: string;
  taskId: string;
  divisionId: string;
  model: string;
  prompt: string;
  taskTitle: string;
  taskDescription: string;
  workspacePath: string;
}

export type RunEvent =
  | { type: "text"; content: string }
  | { type: "tool"; name: string; summary: string }
  // permission: jenis aksi dari OpenCode (bash, edit, webfetch, ...) dan pola targetnya
  | { type: "permission"; permissionId: string; permission: string; patterns: string[] }
  | { type: "usage"; tokensIn: number; tokensOut: number }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

export interface AgentRuntime {
  startRun(input: StartRunInput): Promise<void>;
  cancelRun(runId: string): Promise<void>;
  respondPermission(runId: string, permissionId: string, decision: "allow" | "deny"): Promise<void>;
  onEvent(runId: string, callback: (event: RunEvent) => Promise<void> | void): void;
}

export const AGENT_RUNTIME = Symbol("AGENT_RUNTIME");
