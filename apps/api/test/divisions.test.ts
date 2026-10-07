import { describe, expect, it } from "vitest";
import { FileDivisionRepository } from "../src/modules/divisions/infrastructure/file-division.repository.js";

describe("FileDivisionRepository", () => {
  it("loads markdown division configurations", () => {
    const repo = new FileDivisionRepository("./house/divisions");
    const divisions = repo.loadAll();

    expect(divisions.length).toBeGreaterThanOrEqual(2);

    const pm = repo.loadById("pm");
    expect(pm).not.toBeNull();
    expect(pm?.name).toBe("Product & Project Management");

    const dev = repo.loadById("software-development");
    expect(dev).not.toBeNull();
    expect(dev?.permission.bash.deny).toContain("rm -rf *");
  });
});
