import { describe, expect, it } from "vitest";
import { insideOf, laneOf, roomById, SPOTS } from "./layout.ts";
import { buildPath } from "./walk.ts";

describe("buildPath", () => {
  it("di ruangan yang sama langsung ke tujuan", () => {
    expect(buildPath("pm", "pm", [1, 2])).toEqual([[1, 2]]);
  });

  it("antar ruangan lewat pintu dan koridor", () => {
    const pm = roomById("pm")!;
    const qa = roomById("qa-testing")!;
    expect(buildPath("pm", "qa-testing", [9, 9])).toEqual([insideOf(pm), laneOf(pm), laneOf(qa), insideOf(qa), [9, 9]]);
  });

  it("ke pantry berakhir di titik pantry", () => {
    const path = buildPath("devops", "hall", SPOTS.pantry);
    expect(path.at(-1)).toEqual(SPOTS.pantry);
    expect(path.at(-2)).toEqual([13, 0]);
  });
});
