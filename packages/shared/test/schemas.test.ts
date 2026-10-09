import { describe, expect, it } from "vitest";
import {
  DivisionConfigSchema,
  ProjectPlanSchema,
  RiskLevelSchema,
} from "../src/schemas/index.js";

describe("Shared Schemas", () => {
  it("validates risk levels", () => {
    expect(RiskLevelSchema.safeParse(0).success).toBe(true);
    expect(RiskLevelSchema.safeParse(3).success).toBe(true);
    expect(RiskLevelSchema.safeParse(5).success).toBe(false);
  });

  it("validates project plan schema", () => {
    const validPlan = {
      title: "Landing Page",
      goal: "Buat landing page warung kopi",
      tasks: [
        {
          title: "UI Spec",
          divisionId: "ui-ux",
          description: "Desain wireframe",
          doneCriteria: "Ada spec.md",
          dependsOnTitles: [],
        },
      ],
    };
    expect(ProjectPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("validates division config schema", () => {
    const validDivision = {
      id: "pm",
      name: "Product Manager",
      description: "Manage project",
      model: "9router/claude-3-5-sonnet",
      permission: {
        read: "allow",
        edit: "workspace",
        bash: {
          allow: ["git status"],
          ask: ["git push"],
          deny: ["rm -rf /"],
        },
        webfetch: "allow",
      },
      prompt: "Kamu adalah PM.",
    };
    expect(DivisionConfigSchema.safeParse(validDivision).success).toBe(true);
  });
});
