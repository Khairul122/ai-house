import { z } from "zod";

export const RiskLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4)
]);

export const TaskStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_approval",
  "blocked",
  "done",
  "failed",
  "cancelled"
]);

export const ProjectStatusSchema = z.enum([
  "draft",
  "planning",
  "plan_review",
  "in_progress",
  "completed",
  "failed",
  "cancelled"
]);

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired"
]);

export const ReligionSchema = z.enum(["islam", "protestan", "katolik", "hindu", "buddha", "konghucu"]);

export const DivisionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  model: z.string(),
  // agama karakter divisi di kantor 3D (menentukan tempat dan waktu ibadahnya)
  religion: ReligionSchema.optional(),
  permission: z.object({
    read: z.enum(["allow", "deny"]).default("allow"),
    edit: z.enum(["workspace", "deny"]).default("workspace"),
    bash: z.object({
      allow: z.array(z.string()).default([]),
      ask: z.array(z.string()).default([]),
      deny: z.array(z.string()).default([])
    }).default({ allow: [], ask: [], deny: [] }),
    webfetch: z.enum(["allow", "deny"]).default("allow")
  }),
  prompt: z.string()
});

export const PlanTaskItemSchema = z.object({
  title: z.string(),
  divisionId: z.string(),
  description: z.string(),
  doneCriteria: z.string(),
  dependsOnTitles: z.array(z.string()).default([])
});

export const ProjectPlanSchema = z.object({
  title: z.string(),
  goal: z.string(),
  tasks: z.array(PlanTaskItemSchema)
});

export const CreateProjectInputSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
  tokenBudget: z.number().int().positive().optional()
});

export const ApprovalDecisionInputSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decidedBy: z.string()
});
