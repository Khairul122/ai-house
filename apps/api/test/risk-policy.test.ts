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

import { assessPermission } from "../src/modules/approvals/domain/permission-assessor.js";

describe("assessPermission", () => {
  const rules = {
    read: "allow" as const,
    edit: "workspace" as const,
    webfetch: "deny" as const,
    bash: { allow: ["npm test*"], ask: ["docker run*"], deny: ["docker system prune*"] }
  };
  const ws = "D:/house/workspaces/p1";

  it("memakai daftar allow, ask, dan deny milik divisi", () => {
    expect(assessPermission(rules, ws, "bash", ["npm test -- --run"]).allowed).toBe(true);
    expect(assessPermission(rules, ws, "bash", ["docker run nginx"]).requiresApproval).toBe(true);
    expect(assessPermission(rules, ws, "bash", ["docker system prune -a"]).riskLevel).toBe(4);
  });

  it("pola paling berisiko yang menang", () => {
    expect(assessPermission(rules, ws, "bash", ["npm test", "rm -rf /"]).riskLevel).toBe(4);
  });

  it("edit hanya di dalam workspace, webfetch mengikuti aturan", () => {
    expect(assessPermission(rules, ws, "edit", ["src/index.ts"]).allowed).toBe(true);
    expect(assessPermission(rules, ws, "edit", ["../../rahasia.txt"]).riskLevel).toBe(4);
    expect(assessPermission(rules, ws, "webfetch", ["https://contoh.id"]).riskLevel).toBe(4);
    expect(assessPermission(rules, ws, "external_directory", ["C:/"]).requiresApproval).toBe(true);
  });

  it("aksi shell v2 dinilai seperti bash, konfigurasi izin dilindungi", () => {
    expect(assessPermission(rules, ws, "shell", ["docker run nginx"]).requiresApproval).toBe(true);
    expect(assessPermission(rules, ws, "edit", ["opencode.json"]).riskLevel).toBe(4);
    expect(assessPermission(rules, ws, "edit", [".opencode/agent.md"]).riskLevel).toBe(4);
    expect(assessPermission(rules, ws, "edit", ["D:\\house\\workspaces\\p1\\.opencode\\agent.md"]).riskLevel).toBe(4);
    expect(assessPermission(rules, ws, "edit", ["src/opencode-notes.md"]).allowed).toBe(true);
  });
});

describe("perintah baca-saja", () => {
  const policy = new RiskPolicy();
  it("cek versi dan daftar folder kerja otomatis diizinkan", () => {
    for (const cmd of ["node -v", "npm --version", "python3 --version", "ls", "dir", "ls -la", "pwd"]) {
      expect(policy.assessBashCommand(cmd).allowed, cmd).toBe(true);
    }
  });
  it("yang mirip tapi punya efek tetap ditanya atau ditolak", () => {
    expect(policy.assessBashCommand("node -v && rm -rf build").allowed).toBe(false);
    expect(policy.assessBashCommand("ls ../../").allowed).toBe(false);
    expect(policy.assessBashCommand("dir C:\\Users").allowed).toBe(false);
  });
});
