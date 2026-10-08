import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { OrchestratorService } from "../../orchestrator/orchestrator.service.js";
import { getAutonomy, setAutonomy } from "../../settings/autonomy.js";
import { FileDivisionRepository } from "../../divisions/infrastructure/file-division.repository.js";
import { BriefInputSchema, composeBrief, decodeFiles, writeBrief } from "../application/brief.js";
import { ProjectService } from "../application/project.service.js";

@Controller("api")
export class ProjectsController {
  constructor(
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(OrchestratorService) private readonly orchestrator: OrchestratorService,
    @Inject(FileDivisionRepository) private readonly divisions: FileDivisionRepository
  ) {}

  @Get("projects")
  list() {
    return this.projectService.listProjects();
  }

  @Get("projects/:id")
  get(@Param("id") id: string) {
    return this.orchestrator.detail(id);
  }

  @Post("projects")
  async create(@Body() body: unknown) {
    const parsed = BriefInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Isian proyek tidak valid.");
    const input = parsed.data;
    let files: ReturnType<typeof decodeFiles>;
    try {
      files = decodeFiles(input.files); // diperiksa dulu, sebelum proyek dibuat
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const project = await this.projectService.createProject(input.title, input.goal, input.tokenBudget);
    const nameOf = (id: string) => this.divisions.loadById(id)?.name ?? id;
    writeBrief(project.workspacePath, composeBrief(input, files, nameOf), files);
    // Mode otomatis: PM langsung mulai merencanakan tanpa perlu ditekan.
    if ((await getAutonomy()) === "auto") await this.orchestrator.planProject(project.id);
    return project;
  }

  @Get("projects/:id/report")
  report(@Param("id") id: string) {
    return this.orchestrator.report(id);
  }

  @Get("settings/autonomy")
  async autonomy() {
    return { mode: await getAutonomy() };
  }

  @Put("settings/autonomy")
  async setMode(@Body() body: { mode?: string }) {
    if (body.mode !== "auto" && body.mode !== "ask") throw new BadRequestException('mode harus "auto" atau "ask".');
    await setAutonomy(body.mode);
    if (body.mode === "auto") await this.orchestrator.applyAutonomy();
    return { mode: body.mode };
  }

  @Post("projects/:id/plan")
  @HttpCode(202)
  plan(@Param("id") id: string) {
    return this.orchestrator.planProject(id);
  }

  @Post("projects/:id/plan/approve")
  approvePlan(@Param("id") id: string) {
    return this.orchestrator.approvePlan(id);
  }

  @Post("projects/:id/plan/reject")
  rejectPlan(@Param("id") id: string) {
    return this.orchestrator.rejectPlan(id);
  }

  @Post("projects/:id/stop")
  stop(@Param("id") id: string) {
    return this.orchestrator.stopProject(id);
  }

  @Post("tasks/:id/revise")
  revise(@Param("id") id: string, @Body() body: { note?: string }) {
    return this.orchestrator.reviseTask(id, body.note ?? "");
  }

  @Post("tasks/:id/retry")
  retry(@Param("id") id: string) {
    return this.orchestrator.retryTask(id);
  }
}
