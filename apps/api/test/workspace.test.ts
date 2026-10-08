import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { workspaceFor } from "../src/modules/projects/application/project.service.js";

describe("workspaceFor", () => {
  const saved = process.env.WORKSPACES_DIR;
  afterEach(() => {
    process.env.WORKSPACES_DIR = saved;
  });

  it("proyek nyata ke WORKSPACES_DIR dengan nama folder yang terbaca", () => {
    process.env.WORKSPACES_DIR = "D:/real-aihouse";
    const dir = workspaceFor("01M4C41BFDAMDXTXMPHNBEMCZ3", "Landing page Kopi Senja!");
    expect(dir).toBe(path.join(path.resolve("D:/real-aihouse"), "landing-page-kopi-senja-nbemcz3".replace("nbemcz3", "bemcz3")));
  });

  it("proyek demo tetap di folder internal", () => {
    process.env.WORKSPACES_DIR = "D:/real-aihouse";
    expect(workspaceFor("01ABCDEF", "Demo: x", true).startsWith(path.resolve("./workspaces"))).toBe(true);
  });

  it("judul tanpa huruf latin tetap mendapat nama", () => {
    process.env.WORKSPACES_DIR = "D:/real-aihouse";
    expect(path.basename(workspaceFor("01ABCDEF", "!!!"))).toBe("proyek-abcdef");
  });
});
