import { z } from "zod";
import type {
  ApprovalDecisionInputSchema,
  ApprovalStatusSchema,
  CreateProjectInputSchema,
  DivisionConfigSchema,
  PersonaSchema,
  PlanTaskItemSchema,
  ProjectPlanSchema,
  ProjectStatusSchema,
  RiskLevelSchema,
  TaskStatusSchema
} from "../schemas/index.js";

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type DivisionConfig = z.infer<typeof DivisionConfigSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type PlanTaskItem = z.infer<typeof PlanTaskItemSchema>;
export type ProjectPlan = z.infer<typeof ProjectPlanSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInputSchema>;

export interface Division {
  id: string;
  name: string;
  description: string;
  model: string;
  promptHash: string;
  configJson: string;
  enabled: boolean;
}

export interface Project {
  id: string;
  title: string;
  goal: string;
  status: ProjectStatus;
  workspacePath: string;
  tokenBudget: number | null;
  tokensUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  divisionId: string;
  title: string;
  description: string;
  doneCriteria: string;
  status: TaskStatus;
  attempt: number;
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependency {
  taskId: string;
  dependsOnId: string;
}

export interface Run {
  id: string;
  taskId: string;
  sessionId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
}

export interface Approval {
  id: string;
  runId: string;
  riskLevel: RiskLevel;
  actionType: string;
  actionSummary: string;
  payloadJson: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  expiresAt: string;
}

export interface Artifact {
  id: string;
  projectId: string;
  taskId: string;
  path: string;
  kind: string;
  size: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  detailJson: string;
  occurredAt: string;
}
