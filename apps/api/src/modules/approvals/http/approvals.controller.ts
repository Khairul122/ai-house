import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { listPendingApprovals } from "../../office/office.controller.js";
import { ApprovalService } from "../application/approval.service.js";

@Controller("api/approvals")
export class ApprovalsController {
  constructor(
    @Inject(ApprovalService) private readonly approvals: ApprovalService,
  ) {}

  @Get()
  list() {
    return listPendingApprovals();
  }

  @Post(":id/decision")
  decide(
    @Param("id") id: string,
    @Body() body: { decision?: string; decidedBy?: string },
  ) {
    if (body.decision !== "approved" && body.decision !== "rejected") {
      throw new BadRequestException(
        'decision harus "approved" atau "rejected".',
      );
    }
    return this.approvals.decide(
      id,
      body.decision,
      body.decidedBy || "web-user",
    );
  }
}
