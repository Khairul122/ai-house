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
  | { type: "permission"; permissionId: string; actionSummary: string; riskLevel: number }
  | { type: "usage"; tokensIn: number; tokensOut: number }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

export interface AgentRuntime {
  startRun(input: StartRunInput): Promise<void>;
  cancelRun(runId: string): Promise<void>;
  respondPermission(runId: string, permissionId: string, decision: "allow" | "deny"): Promise<void>;
  onEvent(runId: string, callback: (event: RunEvent) => Promise<void> | void): void;
}
