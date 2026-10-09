import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { approvals } from "../../../db/schema/index.js";
import { AuditService } from "../../audit/audit.service.js";
import { EventBusService } from "../../events/event-bus.service.js";

export type Decision = "approved" | "rejected";

// Satu-satunya jalan untuk memutuskan persetujuan: dashboard, Telegram, dan batas waktu.
@Injectable()
export class ApprovalService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(EventBusService) private readonly eventBus: EventBusService,
  ) {}

  async decide(
    id: string,
    decision: Decision,
    decidedBy: string,
    status: Decision | "expired" = decision,
  ) {
    const row = await db.query.approvals.findFirst({
      where: eq(approvals.id, id),
    });
    if (!row) throw new NotFoundException("Persetujuan tidak ditemukan.");
    if (row.status !== "pending")
      throw new ConflictException("Persetujuan ini sudah diputuskan.");

    await db
      .update(approvals)
      .set({ status, decidedBy, decidedAt: new Date().toISOString() })
      .where(and(eq(approvals.id, id), eq(approvals.status, "pending")));
    await this.audit.record(decidedBy, "approval_decided", "approval", id, {
      decision,
      summary: row.actionSummary,
    });
    this.eventBus.publish("approval.decided", { id, decision });
    return { ok: true, id, decision };
  }
}
