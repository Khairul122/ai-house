import { Controller, Get, Inject } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { approvals, runs, tasks } from "../../db/schema/index.js";
import { AuditService } from "../audit/audit.service.js";
import { FileDivisionRepository } from "../divisions/infrastructure/file-division.repository.js";
import { PLAN_TASK_TITLE } from "../orchestrator/orchestrator.service.js";
import { getHouseProfile } from "../settings/house.js";
import { deriveOfficeState } from "./office-state.js";

export function listPendingApprovals() {
  return db
    .select({
      id: approvals.id,
      runId: approvals.runId,
      riskLevel: approvals.riskLevel,
      actionType: approvals.actionType,
      actionSummary: approvals.actionSummary,
      expiresAt: approvals.expiresAt,
      divisionId: tasks.divisionId,
      taskTitle: tasks.title
    })
    .from(approvals)
    .leftJoin(runs, eq(approvals.runId, runs.id))
    .leftJoin(tasks, eq(runs.taskId, tasks.id))
    .where(eq(approvals.status, "pending"));
}

@Controller("api")
export class OfficeController {
  constructor(
    @Inject(FileDivisionRepository)
    private readonly divisionRepo: FileDivisionRepository,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Get("office")
  async office() {
    const divisionIds = this.divisionRepo.loadAll().map((d) => d.id);
    const taskRows = await db.query.tasks.findMany();
    return deriveOfficeState(divisionIds, taskRows, await listPendingApprovals());
  }

  // Profil kantor dan divisi koordinatornya, dipakai dashboard menggantikan nilai tetap di kode.
  @Get("house")
  house() {
    return { ...getHouseProfile(), coordinatorId: this.divisionRepo.coordinatorId(), planTaskTitle: PLAN_TASK_TITLE };
  }

  @Get("audit")
  audit() {
    return this.auditService.listRecent(100);
  }
}
