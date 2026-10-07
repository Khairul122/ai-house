import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { DivisionConfigSchema, type DivisionConfig } from "@ai-house/shared";

export interface DivisionEntity {
  id: string;
  name: string;
  description: string;
  model: string;
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
    return files.map((file) => this.loadFile(path.join(this.divisionsDir, file)));
  }

  loadById(id: string): DivisionEntity | null {
    const filePath = path.join(this.divisionsDir, `${id}.md`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return this.loadFile(filePath);
  }

  // Mengganti baris `model:` di frontmatter tanpa menyentuh isi lain berkas.
  setModel(id: string, model: string): DivisionEntity | null {
    const filePath = path.join(this.divisionsDir, `${id}.md`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const end = raw.indexOf("\n---", 3);
    if (!raw.startsWith("---") || end < 0) throw new Error(`Frontmatter ${id}.md tidak valid.`);
    const head = raw.slice(0, end);
    const nextHead = /^model:.*$/m.test(head) ? head.replace(/^model:.*$/m, `model: ${model}`) : `${head}\nmodel: ${model}`;
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
      prompt: parsed.prompt,
      promptHash,
      permission: parsed.permission
    };
  }

  private parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const yamlStr = match[1];
    const body = match[2];

    const lines = yamlStr.split("\n");
    const frontmatter: Record<string, any> = {};

    let currentObj: any = frontmatter;
    let currentKey = "";
    let inArray = false;
    let arrayKey = "";

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line || line.startsWith("#")) continue;

      const indent = rawLine.search(/\S/);

      if (line.includes(":") && !line.trim().startsWith("-")) {
        inArray = false;
        const [k, ...v] = line.split(":");
        const key = k.trim();
        const val = v.join(":").trim();

        if (indent === 0) {
          if (!val) {
            frontmatter[key] = {};
            currentObj = frontmatter[key];
            currentKey = key;
          } else {
            frontmatter[key] = this.parseVal(val);
            currentObj = frontmatter;
            currentKey = key;
          }
        } else if (indent === 2) {
          if (!val) {
            frontmatter[currentKey][key] = {};
            currentObj = frontmatter[currentKey][key];
          } else {
            frontmatter[currentKey][key] = this.parseVal(val);
          }
        } else if (indent === 4) {
          currentObj[key] = this.parseVal(val);
        }
      } else if (line.trim().startsWith("-")) {
        const item = line.trim().replace(/^-\s*/, "");
        if (!Array.isArray(currentObj[arrayKey])) {
          currentObj[arrayKey] = [];
        }
        currentObj[arrayKey].push(this.parseVal(item));
      }
    }

    return { frontmatter, body };
  }

  private parseVal(val: string): any {
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }
    if (val === "true") return true;
    if (val === "false") return false;
    return val.replace(/^["']|["']$/g, "");
  }
}
