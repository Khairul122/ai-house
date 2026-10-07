import { Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { taskDependencies, tasks } from "../../../db/schema/index.js";

@Injectable()
export class TaskService {
  async listProjectTasks(projectId: string) {
    return db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId)
    });
  }

  // Tugas antre yang semua prasyaratnya sudah selesai.
  async getExecutableTasks(projectId: string) {
    const allTasks = await this.listProjectTasks(projectId);
    const queued = allTasks.filter((t) => t.status === "queued");
    if (!queued.length) return [];

    const deps = await db.query.taskDependencies.findMany({
      where: inArray(taskDependencies.taskId, queued.map((t) => t.id))
    });
    const done = new Set(allTasks.filter((t) => t.status === "done").map((t) => t.id));
    return queued.filter((t) => deps.filter((d) => d.taskId === t.id).every((d) => done.has(d.dependsOnId)));
  }
}
