import fs from "node:fs";
import path from "node:path";
import { Controller, ForbiddenException, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { projects } from "../../../db/schema/index.js";

interface Reply {
  header(name: string, value: string): Reply;
  send(body: unknown): Reply;
}

// Berkas milik House/OpenCode, bukan hasil kerja divisi.
const HIDDEN = /^(opencode\.jsonc?|\.opencode|\.git|node_modules)$/i;
const MAX_FILES = 500;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

async function workspaceOf(id: string) {
  const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!p) throw new NotFoundException("Proyek tidak ditemukan.");
  return path.resolve(p.workspacePath);
}

// Path relatif dari permintaan harus tetap di dalam workspace.
function resolveInside(root: string, rel: string) {
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw new ForbiddenException("Path di luar workspace.");
  if (rel.split(/[\\/]/).some((seg) => HIDDEN.test(seg))) throw new NotFoundException("Berkas tidak ditemukan.");
  return full;
}

function walk(root: string) {
  const out: { path: string; size: number; modifiedAt: string }[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (HIDDEN.test(entry.name) || out.length >= MAX_FILES) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const st = fs.statSync(full);
        out.push({ path: path.relative(root, full).split(path.sep).join("/"), size: st.size, modifiedAt: st.mtime.toISOString() });
      }
    }
  };
  if (fs.existsSync(root)) visit(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

@Controller("api/projects/:id")
export class WorkspaceFilesController {
  @Get("files")
  async list(@Param("id") id: string) {
    return walk(await workspaceOf(id));
  }

  // Menyajikan berkas hasil kerja. Header sandbox membuat halaman buatan agen berjalan di origin
  // terisolasi, sehingga skripnya tidak bisa memanggil API House (mis. menyetujui izin).
  @Get("files/*")
  async file(@Param("id") id: string, @Param("*") rel: string, @Res() reply: Reply) {
    const full = resolveInside(await workspaceOf(id), decodeURIComponent(rel ?? ""));
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new NotFoundException("Berkas tidak ditemukan.");
    const type = TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream";
    return reply
      .header("Content-Type", type)
      .header("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-popups")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "no-store")
      .send(fs.createReadStream(full));
  }
}
