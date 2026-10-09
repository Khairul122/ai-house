import { describe, expect, it } from "vitest";
import { deriveOfficeState } from "../src/modules/office/office-state.js";

const task = (
  id: string,
  divisionId: string,
  status: string,
  updatedAt: string,
) => ({
  id,
  divisionId,
  title: `Tugas ${id}`,
  status,
  updatedAt,
});

describe("deriveOfficeState", () => {
  it("memetakan status tiap divisi dengan prioritas yang benar", () => {
    const state = deriveOfficeState(
      ["dev", "qa", "ops", "pm"],
      [
        task("t1", "dev", "done", "2026-01-01T00:00:00Z"),
        task("t2", "dev", "running", "2026-01-01T00:01:00Z"),
        task("t3", "qa", "failed", "2026-01-01T00:02:00Z"),
        task("t4", "ops", "running", "2026-01-01T00:03:00Z"),
        task("t5", "pm", "done", "2026-01-01T00:04:00Z"),
      ],
      [
        {
          id: "a1",
          divisionId: "ops",
          actionSummary: "docker-compose up",
          riskLevel: 3,
        },
      ],
    );

    expect(state.map((s) => s.status)).toEqual([
      "working",
      "failed",
      "waiting",
      "idle",
    ]);
    expect(state[0].task?.id).toBe("t2");
    expect(state[2].approval?.id).toBe("a1");
    expect(state[3].task).toBeNull();
  });
});
