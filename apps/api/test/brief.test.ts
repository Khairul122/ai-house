import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BriefInputSchema, composeBrief, decodeFiles, readBrief, safeFileName, writeBrief } from "../src/modules/projects/application/brief.js";

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("brief proyek", () => {
  it("nama berkas aman: tanpa folder, tanpa menimpa brief.md, tanpa bentrok", () => {
    const taken = new Set<string>(["brief.md"]);
    expect(safeFileName("..\\..\\rahasia/PRD Final!!.md", taken)).toBe("PRD-Final.md");
    expect(safeFileName("PRD Final.md", taken)).toBe("PRD-Final-2.md");
    expect(safeFileName("brief.md", taken)).toBe("berkas.md");
  });

  it("menolak jenis berkas yang tidak didukung dan berkas terlalu besar", () => {
    expect(() => decodeFiles([{ name: "virus.exe", contentBase64: b64("x") }])).toThrow(/tidak didukung/);
    const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
    expect(() => decodeFiles([{ name: "besar.pdf", contentBase64: big }])).toThrow(/10 MB/);
  });

  it("menyusun dan menyimpan brief lengkap", () => {
    const input = BriefInputSchema.parse({
      title: "Toko kue",
      goal: "Landing page pesanan kue",
      audience: "Ibu rumah tangga di Bandung",
      priority: "tinggi",
      divisions: ["ui-ux-design", "software-development"],
      files: [{ name: "sitemap.md", contentBase64: b64("# Sitemap") }]
    });
    const files = decodeFiles(input.files);
    const brief = composeBrief(input, files, (id) => (id === "ui-ux-design" ? "UI/UX Design" : id));
    expect(brief).toContain("## Target pengguna\nIbu rumah tangga di Bandung");
    expect(brief).toContain("## Prioritas\nTinggi");
    expect(brief).toContain("- UI/UX Design (ui-ux-design)");
    expect(brief).toContain("- brief/sitemap.md");
    expect(brief).not.toContain("## Gaya dan nuansa"); // isian kosong tidak ditulis

    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "house-brief-"));
    writeBrief(ws, brief, files);
    expect(fs.readFileSync(path.join(ws, "brief", "sitemap.md"), "utf-8")).toBe("# Sitemap");
    expect(readBrief(ws)).toBe(brief);
    fs.rmSync(ws, { recursive: true, force: true });
  });
});
