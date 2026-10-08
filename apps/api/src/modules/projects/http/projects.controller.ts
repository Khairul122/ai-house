import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { CreateProjectInputSchema } from "@ai-house/shared";
import { OrchestratorService } from "../../orchestrator/orchestrator.service.js";
import { getAutonomy, setAutonomy } from "../../settings/autonomy.js";
import { ProjectService } from "../application/project.service.js";

@Controller("api")
export class ProjectsController {
  constructor(
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(OrchestratorService) private readonly orchestrator: OrchestratorService
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
    const parsed = CreateProjectInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Judul dan tujuan proyek wajib diisi.");
    const { title, goal, tokenBudget } = parsed.data;
    const project = await this.projectService.createProject(title, goal, tokenBudget);
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

  @Post("tasks/:id/retry")
  retry(@Param("id") id: string) {
    return this.orchestrator.retryTask(id);
  }
}
