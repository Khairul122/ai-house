import { describe, expect, it } from "vitest";
import { emotionOf, lowestNeed, mood, stepNeeds } from "./sims.ts";

const full = { energi: 80, sosial: 80, hiburan: 80, spiritual: 80 };

describe("kebutuhan", () => {
  it("kerja menguras energi, tidur mengisinya, tetap di rentang 0..100", () => {
    expect(stepNeeds(full, "kerja", 10).energi).toBeLessThan(80);
    expect(stepNeeds({ ...full, energi: 10 }, "tidur", 5).energi).toBe(80);
    expect(stepNeeds({ ...full, energi: 99 }, "tidur", 5).energi).toBe(100);
    expect(stepNeeds({ ...full, energi: 1 }, "kerja", 60).energi).toBe(0);
  });

  it("ngobrol mengisi sosial, ibadah mengisi spiritual", () => {
    expect(
      stepNeeds({ ...full, sosial: 10 }, "ngobrol", 2).sosial,
    ).toBeGreaterThan(40);
    expect(stepNeeds({ ...full, spiritual: 10 }, "ibadah", 2).spiritual).toBe(
      70,
    );
  });

  it("kebutuhan terendah dan suasana hati", () => {
    expect(lowestNeed({ ...full, hiburan: 5 })).toBe("hiburan");
    expect(mood(full)).toBe(80);
  });
});

describe("emosi", () => {
  it("status kerja nyata menentukan emosi", () => {
    expect(emotionOf(full, "failed", "diam")).toBe("sedih");
    expect(emotionOf(full, "waiting", "diam")).toBe("cemas");
    expect(emotionOf(full, "working", "kerja")).toBe("fokus");
    expect(emotionOf({ ...full, energi: 10 }, "working", "kerja")).toBe(
      "lelah",
    );
  });

  it("saat santai mengikuti kebutuhan", () => {
    expect(emotionOf({ ...full, sosial: 10 }, "idle", "diam")).toBe("kesepian");
    expect(emotionOf({ ...full, hiburan: 10 }, "idle", "diam")).toBe("bosan");
    expect(emotionOf(full, "idle", "diam")).toBe("senang");
    expect(emotionOf(full, "idle", "ibadah")).toBe("khusyuk");
  });
});
