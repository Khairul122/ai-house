import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { CreateProjectInputSchema } from "@ai-house/shared";
import { ProjectService } from "../application/project.service.js";

@Controller("api/projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectService)
    private readonly projectService: ProjectService
  ) {}

  @Get()
  list() {
    return this.projectService.listProjects();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projectService.getProject(id);
  }

  @Post()
  create(@Body() body: unknown) {
    const input = CreateProjectInputSchema.parse(body);
    return this.projectService.createProject(input.title, input.goal, input.tokenBudget);
  }
}
