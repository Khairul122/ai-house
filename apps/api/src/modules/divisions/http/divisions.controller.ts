import { Controller, Get, Inject, Param } from "@nestjs/common";
import { FileDivisionRepository } from "../infrastructure/file-division.repository.js";

@Controller("api/divisions")
export class DivisionsController {
  constructor(
    @Inject(FileDivisionRepository)
    private readonly divisionRepo: FileDivisionRepository
  ) {}

  @Get()
  list() {
    return this.divisionRepo.loadAll();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.divisionRepo.loadById(id);
  }
}
