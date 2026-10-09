import path from "node:path";
import type { DivisionConfig } from "@ai-house/shared";
import { type ActionAssessment, RiskPolicy } from "./risk-policy.js";

const policy = new RiskPolicy();

const allow = (riskLevel: 0 | 1 | 2, reason: string): ActionAssessment => ({
  riskLevel,
  allowed: true,
  requiresApproval: false,
  reason,
});
const deny = (reason: string): ActionAssessment => ({
  riskLevel: 4,
  allowed: false,
  requiresApproval: false,
  reason,
});
const ask = (reason: string): ActionAssessment => ({
  riskLevel: 3,
  allowed: false,
  requiresApproval: true,
  reason,
});

// Berkas konfigurasi OpenCode di workspace mengatur izin agen; agen tidak boleh mengubahnya sendiri.
const PROTECTED = /(^|[\\/])(opencode\.jsonc?|\.opencode)([\\/]|$)/i;

// Pilih penilaian paling berisiko: tolak > tanya > izinkan.
function worst(list: ActionAssessment[]): ActionAssessment {
  return list.reduce((a, b) => (b.riskLevel > a.riskLevel ? b : a));
}

// Menerjemahkan permintaan izin OpenCode (jenis aksi + pola target) menjadi tingkat risiko House.
export function assessPermission(
  rules: DivisionConfig["permission"],
  workspace: string,
  permission: string,
  patterns: string[],
): ActionAssessment {
  const targets = patterns.length ? patterns : ["*"];
  switch (permission) {
    case "bash":
    case "shell": // nama aksi di OpenCode v2
      return worst(
        targets.map((cmd) =>
          policy.assessBashCommand(
            cmd,
            rules.bash.allow,
            rules.bash.ask,
            rules.bash.deny,
          ),
        ),
      );
    case "edit":
    case "write":
      if (rules.edit === "deny")
        return deny("Divisi ini tidak boleh mengubah berkas.");
      if (targets.some((p) => PROTECTED.test(p)))
        return deny("Konfigurasi izin OpenCode tidak boleh diubah agen.");
      return worst(
        targets.map((p) =>
          policy.assessWorkspacePath(path.resolve(workspace, p), workspace),
        ),
      );
    case "webfetch":
      return rules.webfetch === "allow"
        ? allow(1, "Akses web diizinkan untuk divisi ini.")
        : deny("Divisi ini tidak boleh mengakses web.");
    case "read":
    case "glob":
    case "grep":
    case "list":
      return rules.read === "allow"
        ? allow(0, "Membaca berkas.")
        : deny("Divisi ini tidak boleh membaca berkas.");
    case "todowrite":
    case "todoread":
      return allow(0, "Catatan internal agen.");
    case "skill":
      return allow(0, "Memuat panduan skill (hanya instruksi).");
    case "task":
    case "subagent": // nama aksi sub-agen di OpenCode v2
      // Sub-agen berjalan di session anak yang izinnya tidak terlihat House; agen harus bekerja langsung.
      return deny("Sub-agen tidak diizinkan di House. Kerjakan langsung.");
    default:
      // Aksi yang belum dikenal (mis. akses folder luar) selalu ditanyakan.
      return ask(
        `Aksi "${permission}" belum dikenal kebijakan, butuh keputusan manusia.`,
      );
  }
}
