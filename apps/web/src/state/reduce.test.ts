import { describe, expect, it } from "vitest";
import {
  type OfficeEvent,
  type OfficeState,
  initialState,
  reduce,
  visibleStatus,
} from "./reduce.ts";

const run = (events: OfficeEvent[], now = 1000): OfficeState =>
  events.reduce((s, e) => reduce(s, e, now), initialState);

describe("reduce", () => {
  it("menjalankan siklus tugas dan persetujuan", () => {
    let s = run([
      {
        type: "task.updated",
        payload: {
          taskId: "t1",
          divisionId: "devops",
          title: "Rilis",
          status: "running",
        },
      },
    ]);
    expect(s.agents.devops.status).toBe("working");

    s = reduce(s, {
      type: "approval.created",
      payload: {
        id: "a1",
        divisionId: "devops",
        summary: "docker up",
        riskLevel: 3,
      },
    });
    expect(s.agents.devops.status).toBe("waiting");

    // update "running" yang terlambat tidak menghapus tanda menunggu izin
    s = reduce(s, {
      type: "task.updated",
      payload: {
        taskId: "t1",
        divisionId: "devops",
        title: "Rilis",
        status: "running",
      },
    });
    expect(s.agents.devops.status).toBe("waiting");

    s = reduce(s, {
      type: "approval.decided",
      payload: { id: "a1", decision: "approved" },
    });
    expect(s.agents.devops.status).toBe("working");
    expect(s.agents.devops.approval).toBeNull();

    s = reduce(
      s,
      {
        type: "task.updated",
        payload: {
          taskId: "t1",
          divisionId: "devops",
          title: "Rilis",
          status: "done",
        },
      },
      5000,
    );
    expect(visibleStatus(s.agents.devops, 5000)).toBe("done");
    expect(visibleStatus(s.agents.devops, 9000)).toBe("idle");
  });

  it("menolak persetujuan membuat agen santai, gagal tetap terlihat", () => {
    let s = run([
      {
        type: "approval.created",
        payload: { id: "a2", divisionId: "qa", summary: "x", riskLevel: 3 },
      },
      { type: "approval.decided", payload: { id: "a2", decision: "rejected" } },
    ]);
    expect(s.agents.qa.status).toBe("idle");
    s = reduce(s, {
      type: "task.updated",
      payload: {
        taskId: "t2",
        divisionId: "qa",
        title: "Uji",
        status: "failed",
      },
    });
    expect(visibleStatus(s.agents.qa, 999999)).toBe("failed");
    s = reduce(s, {
      type: "task.updated",
      payload: {
        taskId: "t3",
        divisionId: "qa",
        title: "Uji",
        status: "cancelled",
      },
    });
    expect(s.agents.qa.status).toBe("idle");
  });

  it("antrean map tugas PM", () => {
    let s = run([
      {
        type: "task.dispatched",
        payload: { taskId: "t1", to: "qa", title: "A" },
      },
      {
        type: "task.dispatched",
        payload: { taskId: "t2", to: "dev", title: "B" },
      },
    ]);
    expect(s.dispatches.map((d) => d.taskId)).toEqual(["t1", "t2"]);
    s = reduce(s, { type: "dispatch.delivered", payload: { taskId: "t1" } });
    expect(s.dispatches.map((d) => d.taskId)).toEqual(["t2"]);
  });

  it("snapshot mengganti seluruh status", () => {
    const s = run([
      {
        type: "snapshot",
        payload: [
          {
            divisionId: "pm",
            status: "working",
            task: { id: "t", title: "Rencana" },
            approval: null,
          },
        ],
      },
    ]);
    expect(s.agents.pm.status).toBe("working");
  });
});
