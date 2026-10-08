import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import YAML from "yaml";
import { DivisionConfigSchema, type DivisionConfig } from "@ai-house/shared";

export interface DivisionEntity {
  id: string;
  name: string;
  description: string;
  model: string;
  role: DivisionConfig["role"];
  order: number;
  religion?: DivisionConfig["religion"];
  persona: DivisionConfig["persona"];
  prompt: string;
  promptHash: string;
  permission: DivisionConfig["permission"];
}

@Injectable()
export class FileDivisionRepository {
  private readonly divisionsDir: string;

  constructor() {
    const candidates = [
      path.resolve(process.cwd(), "house/divisions"),
      path.resolve(process.cwd(), "../../house/divisions"),
      path.resolve(process.cwd(), "../house/divisions")
    ];
    this.divisionsDir = candidates.find((dir) => fs.existsSync(dir)) || path.resolve(process.cwd(), "house/divisions");
  }

  loadAll(): DivisionEntity[] {
    if (!fs.existsSync(this.divisionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.divisionsDir).filter((f) => f.endsWith(".md"));
    return files
      .map((file) => this.loadFile(path.join(this.divisionsDir, file)))
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  // Divisi yang menyusun rencana dan membagi tugas: yang ber-role "coordinator", atau divisi pertama bila tidak ada.
  coordinator(): DivisionEntity | null {
    const all = this.loadAll();
    return all.find((d) => d.role === "coordinator") ?? all[0] ?? null;
  }

  coordinatorId(): string | null {
    return this.coordinator()?.id ?? null;
  }

  loadById(id: string): DivisionEntity | null {
    const filePath = path.join(this.divisionsDir, `${id}.md`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return this.loadFile(filePath);
  }

  setModel(id: string, model: string): DivisionEntity | null {
    return this.setField(id, "model", model);
  }

  // Mengganti (atau menambah) satu baris `kunci: nilai` tingkat atas di frontmatter tanpa menyentuh isi lain.
  setField(id: string, key: "model" | "religion", value: string): DivisionEntity | null {
    const filePath = path.join(this.divisionsDir, `${id}.md`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const end = raw.indexOf("\n---", 3);
    if (!raw.startsWith("---") || end < 0) throw new Error(`Frontmatter ${id}.md tidak valid.`);
    const head = raw.slice(0, end);
    const line = new RegExp(`^${key}:.*$`, "m");
    const nextHead = line.test(head) ? head.replace(line, `${key}: ${value}`) : `${head}\n${key}: ${value}`;
    fs.writeFileSync(filePath, nextHead + raw.slice(end));
    return this.loadFile(filePath);
  }

  private loadFile(filePath: string): DivisionEntity {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { frontmatter, body } = this.parseFrontmatter(raw);

    const parsed = DivisionConfigSchema.parse({
      ...frontmatter,
      prompt: body.trim()
    });

    const promptHash = crypto.createHash("sha256").update(parsed.prompt).digest("hex");

    return {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      model: parsed.model,
      role: parsed.role,
      order: parsed.order,
      religion: parsed.religion,
      persona: parsed.persona,
      prompt: parsed.prompt,
      promptHash,
      permission: parsed.permission
    };
  }

  private parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };
    const parsed = YAML.parse(match[1]) as unknown;
    const frontmatter = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    return { frontmatter, body: match[2] };
  }
}
