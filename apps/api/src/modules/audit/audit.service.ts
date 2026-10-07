import { Injectable } from "@nestjs/common";
import { ulid } from "ulid";
import { db } from "../../db/index.js";
import { auditLog } from "../../db/schema/index.js";

@Injectable()
export class AuditService {
  async record(actor: string, eventType: string, subjectType: string, subjectId: string, detail: Record<string, any>): Promise<void> {
    await db.insert(auditLog).values({
      id: ulid(),
      actor,
      eventType,
      subjectType,
      subjectId,
      detailJson: JSON.stringify(detail),
      occurredAt: new Date().toISOString()
    });
  }

  async listRecent(limit: number = 50) {
    return db.query.auditLog.findMany({
      limit,
      orderBy: (audit, { desc }) => [desc(audit.occurredAt)]
    });
  }
}
