import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Brief proyek dari formulir: isian pemilik + berkas perencanaan. Disimpan di <workspace>/brief/
// agar PM dan divisi lain bisa membacanya dengan alat baca biasa.

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const ALLOWED_EXT = [".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".html", ".css", ".pdf", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".svg"];

const text = (max: number) => z.string().trim().max(max).optional();

export const BriefInputSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(120),
  goal: z.string().trim().min(1, "Tujuan wajib diisi.").max(4000),
  audience: text(1500),
  scope: text(4000),
  constraints: text(2000),
  style: text(1500),
  priority: z.enum(["normal", "tinggi", "mendesak"]).optional(),
  divisions: z.array(z.string().max(64)).max(20).optional(),
  notes: text(4000),
  tokenBudget: z.number().int().positive().optional(),
  files: z
    .array(z.object({ name: z.string().min(1).max(200), contentBase64: z.string() }))
    .max(MAX_FILES, `Maksimal ${MAX_FILES} berkas.`)
    .optional()
});
export type BriefInput = z.infer<typeof BriefInputSchema>;

// Nama berkas aman: tanpa folder, karakter aneh, atau nama yang menimpa brief.md.
export function safeFileName(name: string, taken: Set<string>): string {
  const base = path.basename(name.replace(/\\/g, "/"));
  const ext = path.extname(base).toLowerCase();
  let stem = base
    .slice(0, base.length - ext.length)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  if (!stem || stem.toLowerCase() === "brief") stem = "berkas";
  let candidate = `${stem}${ext}`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${stem}-${i}${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

export interface DecodedFile {
  name: string;
  data: Buffer;
}

// Memeriksa jenis dan ukuran berkas sebelum ada yang ditulis ke disk.
export function decodeFiles(files: BriefInput["files"]): DecodedFile[] {
  const taken = new Set<string>(["brief.md"]);
  let total = 0;
  return (files ?? []).map((f) => {
    const ext = path.extname(f.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) throw new Error(`Jenis berkas ${ext || "(tanpa ekstensi)"} tidak didukung: ${f.name}`);
    const data = Buffer.from(f.contentBase64, "base64");
    if (data.length > MAX_FILE_BYTES) throw new Error(`${f.name} lebih dari 10 MB.`);
    total += data.length;
    if (total > MAX_TOTAL_BYTES) throw new Error("Total berkas lebih dari 25 MB.");
    return { name: safeFileName(f.name, taken), data };
  });
}

const PRIORITY: Record<string, string> = { normal: "Normal", tinggi: "Tinggi", mendesak: "Mendesak" };
const kb = (n: number) => (n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`);

export function composeBrief(input: BriefInput, files: DecodedFile[], divisionName: (id: string) => string): string {
  const section = (title: string, body?: string) => (body?.trim() ? `\n## ${title}\n${body.trim()}\n` : "");
  return [
    `# Brief proyek: ${input.title}\n`,
    section("Tujuan", input.goal),
    section("Target pengguna", input.audience),
    section("Fitur dan ruang lingkup", input.scope),
    section("Teknologi dan batasan", input.constraints),
    section("Gaya dan nuansa", input.style),
    section("Prioritas", input.priority ? PRIORITY[input.priority] : undefined),
    section("Divisi yang dilibatkan", input.divisions?.length ? input.divisions.map((d) => `- ${divisionName(d)} (${d})`).join("\n") : undefined),
    section("Catatan tambahan", input.notes),
    section("Berkas pendukung", files.length ? files.map((f) => `- brief/${f.name} (${kb(f.data.length)})`).join("\n") : undefined)
  ].join("");
}

export function writeBrief(workspace: string, brief: string, files: DecodedFile[]) {
  const dir = path.join(workspace, "brief");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(dir, f.name), f.data);
  fs.writeFileSync(path.join(dir, "brief.md"), brief);
}

export function readBrief(workspace: string, maxChars = 8000): string | null {
  const file = path.join(workspace, "brief", "brief.md");
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf-8");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(dipotong, baca brief/brief.md untuk lengkapnya)` : text;
}
