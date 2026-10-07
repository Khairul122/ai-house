import { describe, expect, it } from "vitest";
import { RiskPolicy } from "../src/modules/approvals/domain/risk-policy.js";

describe("RiskPolicy", () => {
  const policy = new RiskPolicy();

  it("permits status and allowed commands as Level 2", () => {
    const res = policy.assessBashCommand("git status");
    expect(res.riskLevel).toBe(2);
    expect(res.allowed).toBe(true);
  });

  it("requires approval for git push as Level 3", () => {
    const res = policy.assessBashCommand("git push origin main");
    expect(res.riskLevel).toBe(3);
    expect(res.requiresApproval).toBe(true);
  });

  it("blocks rm -rf / as Level 4 forbidden", () => {
    const res = policy.assessBashCommand("rm -rf /");
    expect(res.riskLevel).toBe(4);
    expect(res.allowed).toBe(false);
    expect(res.requiresApproval).toBe(false);
  });

  it("blocks directory traversal outside workspace", () => {
    const res = policy.assessWorkspacePath("D:/portofolio/ai-house/workspaces/../../secret.txt", "D:/portofolio/ai-house/workspaces/proj-1");
    expect(res.riskLevel).toBe(4);
    expect(res.allowed).toBe(false);
  });
});
