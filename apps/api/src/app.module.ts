import { Module } from "@nestjs/common";
import { runtimeProvider } from "./modules/agents/runtime.provider.js";
import { ApprovalService } from "./modules/approvals/application/approval.service.js";
import { ApprovalsController } from "./modules/approvals/http/approvals.controller.js";
import { AuditService } from "./modules/audit/audit.service.js";
import { DivisionsController } from "./modules/divisions/http/divisions.controller.js";
import { FileDivisionRepository } from "./modules/divisions/infrastructure/file-division.repository.js";
import { EventBusService } from "./modules/events/event-bus.service.js";
import { EventsController } from "./modules/events/http/events.controller.js";
import { ProjectService } from "./modules/projects/application/project.service.js";
import { ProjectsController } from "./modules/projects/http/projects.controller.js";
import { TaskService } from "./modules/tasks/application/task.service.js";
import { DemoController } from "./modules/office/demo.controller.js";
import { OfficeController } from "./modules/office/office.controller.js";
import { OrchestratorService } from "./modules/orchestrator/orchestrator.service.js";
import { TelegramBotService } from "./modules/telegram/bot.service.js";

@Module({
  imports: [],
  controllers: [
    DivisionsController,
    ProjectsController,
    ApprovalsController,
    EventsController,
    OfficeController,
    DemoController
  ],
  providers: [
    AuditService,
    EventBusService,
    ProjectService,
    TaskService,
    TelegramBotService,
    FileDivisionRepository,
    ApprovalService,
    OrchestratorService,
    runtimeProvider
  ]
})
export class AppModule {}
