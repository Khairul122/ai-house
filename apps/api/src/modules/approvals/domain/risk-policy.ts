import type { RiskLevel } from "@ai-house/shared";

export interface ActionAssessment {
  riskLevel: RiskLevel;
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

export class RiskPolicy {
  private readonly forbiddenPatterns = [
    /rm\s+-rf\s+(\/|\*|~\/)/i,
    /git\s+push\s+.*--force/i,
    /curl\s+.*\|\s*sh/i,
    /wget\s+.*\|\s*sh/i,
    /\.ssh/i,
    /\.\.\/\.\./
  ];

  private readonly riskyPatterns = [
    /git\s+push/i,
    /git\s+merge/i,
    /pnpm\s+(add|install)/i,
    /npm\s+(install|i)/i,
    /deploy/i,
    /ssh\s+/i
  ];

  assessBashCommand(command: string, customAllow: string[] = [], customAsk: string[] = []): ActionAssessment {
    const trimmed = command.trim();

    // Check Level 4 (Forbidden)
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(trimmed)) {
        return {
          riskLevel: 4,
          allowed: false,
          requiresApproval: false,
          reason: "Forbidden command violation (Level 4)."
        };
      }
    }

    // Check custom ask or built-in risky patterns (Level 3)
    const isCustomAsk = customAsk.some((pattern) => this.matchWildcard(trimmed, pattern));
    const isRiskyPattern = this.riskyPatterns.some((pattern) => pattern.test(trimmed));

    if (isCustomAsk || isRiskyPattern) {
      return {
        riskLevel: 3,
        allowed: false,
        requiresApproval: true,
        reason: "Risky operation requires human approval (Level 3)."
      };
    }

    // Check custom allow or safe patterns (Level 2)
    const isCustomAllow = customAllow.some((pattern) => this.matchWildcard(trimmed, pattern));
    if (isCustomAllow || /^git\s+(status|diff|log)/i.test(trimmed)) {
      return {
        riskLevel: 2,
        allowed: true,
        requiresApproval: false,
        reason: "Permitted execution command (Level 2)."
      };
    }

    // Default unknown command -> Level 3 (require approval)
    return {
      riskLevel: 3,
      allowed: false,
      requiresApproval: true,
      reason: "Unrecognized command requires approval (Level 3)."
    };
  }

  assessWorkspacePath(targetPath: string, workspaceRoot: string): ActionAssessment {
    const normalizedTarget = targetPath.replace(/\\/g, "/");
    const normalizedRoot = workspaceRoot.replace(/\\/g, "/");

    if (normalizedTarget.includes("..") || !normalizedTarget.startsWith(normalizedRoot)) {
      return {
        riskLevel: 4,
        allowed: false,
        requiresApproval: false,
        reason: "Path escapes workspace sandbox (Level 4)."
      };
    }

    return {
      riskLevel: 1,
      allowed: true,
      requiresApproval: false,
      reason: "Workspace write access permitted (Level 1)."
    };
  }

  private matchWildcard(str: string, rule: string): boolean {
    const escaped = rule.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(str);
  }
}
