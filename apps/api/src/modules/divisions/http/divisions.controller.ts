import { BadGatewayException, BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { projects, tasks } from "../../../db/schema/index.js";
import { FileDivisionRepository } from "../infrastructure/file-division.repository.js";

export interface RouterModel {
  id: string; // id lengkap untuk divisi, mis. "9router/ComboOpenCode"
  name: string;
  combo: boolean;
  owner: string;
}

let cache: { at: number; models: RouterModel[] } | null = null;

// Daftar model dari 9router, kombo di atas. Disimpan 60 detik agar dropdown tidak membebani router.
export async function listRouterModels(): Promise<RouterModel[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.models;
  const base = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:20128/v1").replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/models`, {
      headers: process.env.NINEROUTER_API_KEY ? { Authorization: `Bearer ${process.env.NINEROUTER_API_KEY}` } : {}
    });
  } catch {
    throw new BadGatewayException(`9router di ${base} tidak terjangkau. Jalankan 9router dulu.`);
  }
  if (!res.ok) throw new BadGatewayException(`9router menolak permintaan daftar model (HTTP ${res.status}).`);
  const body = (await res.json()) as { data?: { id: string; owned_by?: string }[] };
  const models = (body.data ?? [])
    .map((m) => ({ id: `9router/${m.id}`, name: m.id, combo: m.owned_by === "combo", owner: m.owned_by ?? "" }))
    .sort((a, b) => Number(b.combo) - Number(a.combo) || a.name.localeCompare(b.name));
  cache = { at: Date.now(), models };
  return models;
}

@Controller("api")
export class DivisionsController {
  constructor(
    @Inject(FileDivisionRepository)
    private readonly divisionRepo: FileDivisionRepository
  ) {}

  @Get("divisions")
  list() {
    return this.divisionRepo.loadAll();
  }

  @Get("divisions/:id")
  get(@Param("id") id: string) {
    return this.divisionRepo.loadById(id);
  }

  // Pekerjaan divisi di semua proyek, terbaru dulu: apa yang dikerjakan dan hasilnya.
  @Get("divisions/:id/tasks")
  history(@Param("id") id: string) {
    return db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        attempt: tasks.attempt,
        resultSummary: tasks.resultSummary,
        updatedAt: tasks.updatedAt,
        projectId: projects.id,
        projectTitle: projects.title
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.divisionId, id))
      .orderBy(desc(tasks.updatedAt))
      .limit(30);
  }

  @Get("models")
  models() {
    return listRouterModels();
  }

  @Patch("divisions/:id")
  async update(@Param("id") id: string, @Body() body: { model?: string }) {
    if (!body.model) throw new BadRequestException("Model wajib diisi.");
    const known = await listRouterModels();
    if (!known.some((m) => m.id === body.model)) throw new BadRequestException(`Model ${body.model} tidak ada di 9router.`);
    const updated = this.divisionRepo.setModel(id, body.model);
    if (!updated) throw new NotFoundException("Divisi tidak ditemukan.");
    return updated;
  }
}
