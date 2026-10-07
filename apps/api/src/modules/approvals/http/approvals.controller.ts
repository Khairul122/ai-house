import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { approvals } from "../../../db/schema/index.js";
import { AuditService } from "../../audit/audit.service.js";
import { EventBusService } from "../../events/event-bus.service.js";
import { listPendingApprovals } from "../../office/office.controller.js";

@Controller("api/approvals")
export class ApprovalsController {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(EventBusService)
    private readonly eventBus: EventBusService
  ) {}

  @Get()
  list() {
    return listPendingApprovals();
  }

  @Post(":id/decision")
  async decide(
    @Param("id") id: string,
    @Body() body: { decision: "approved" | "rejected"; decidedBy?: string }
  ) {
    const now = new Date().toISOString();
    await db.update(approvals).set({
      status: body.decision,
      decidedBy: body.decidedBy || "web-user",
      decidedAt: now
    }).where(eq(approvals.id, id));

    await this.auditService.record(body.decidedBy || "web-user", "approval_decided", "approval", id, {
      decision: body.decision
    });

    this.eventBus.publish("approval.decided", { id, decision: body.decision });
    return { ok: true, id, decision: body.decision };
  }
}
