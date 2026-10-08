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

export const DivisionRoleSchema = z.enum(["coordinator", "member"]);

export const AccessorySchema = z.enum(["hardhat", "glasses", "hood", "beret", "headphones", "tie", "cap", "bun", "visor", "scarf"]);

// Jenis properti khas di ruangan divisi pada kantor 3D.
export const RoomSignatureSchema = z.enum([
  "board",
  "monitor",
  "easel",
  "server",
  "checklist",
  "screens",
  "chart",
  "camera",
  "books",
  "rack",
  "mic",
  "typewriter",
  "phone",
  "poster"
]);

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Tampilan karakter divisi di kantor 3D. Semua opsional: yang kosong diisi otomatis dari id divisi.
export const PersonaSchema = z.object({
  name: z.string().optional(),
  short: z.string().optional(),
  traits: z.array(z.string()).default([]),
  shirt: HexColor.optional(),
  hair: HexColor.optional(),
  skin: HexColor.optional(),
  accent: HexColor.optional(),
  accessory: AccessorySchema.optional(),
  signature: RoomSignatureSchema.optional(),
  smallTalk: z.array(z.string()).default([])
});

export const DivisionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  model: z.string(),
  // "coordinator" menyusun rencana dan membagi tugas; tepat satu divisi sebaiknya memegang peran ini
  role: DivisionRoleSchema.default("member"),
  // lantai (bidang) tempat ruangan divisi, id dari house/floors.yaml; kosong = lantai pertama
  floor: z.string().optional(),
  // boleh mengajukan unggahan ke akun sosial media terdaftar (lewat berkas publikasi/*.json)
  publish: z.boolean().default(false),
  // urutan ruangan di kantor 3D dan daftar divisi (kecil di depan)
  order: z.coerce.number().default(100),
  // agama karakter divisi di kantor 3D (menentukan tempat dan waktu ibadahnya)
  religion: ReligionSchema.optional(),
  persona: PersonaSchema.default({}),
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

export const FloorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string().default("")
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
