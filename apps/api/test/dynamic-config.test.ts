import { describe, expect, it } from "vitest";
import type { DivisionEntity } from "../src/modules/divisions/infrastructure/file-division.repository.js";
import { FileDivisionRepository } from "../src/modules/divisions/infrastructure/file-division.repository.js";
import { buildDemoPlan } from "../src/modules/office/demo.controller.js";
import { getHouseProfile } from "../src/modules/settings/house.js";

const division = (
  id: string,
  extra: Partial<DivisionEntity> = {},
): DivisionEntity => ({
  id,
  name: id.toUpperCase(),
  description: `Deskripsi ${id}.`,
  model: "m",
  role: "member",
  order: 100,
  persona: { traits: [], smallTalk: [] },
  prompt: "",
  promptHash: "",
  permission: {
    read: "allow",
    edit: "workspace",
    bash: { allow: [], ask: [], deny: [] },
    webfetch: "allow",
  },
  ...extra,
});

describe("konfigurasi divisi dinamis", () => {
  it("persona, urutan, dan koordinator dibaca dari berkas divisi", () => {
    const repo = new FileDivisionRepository();
    const all = repo.loadAll();
    const orders = all.map((d) => d.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(repo.coordinatorId()).toBe(
      all.find((d) => d.role === "coordinator")?.id,
    );
    for (const d of all) expect(d.persona.name, d.id).toBeTruthy();
  });

  it("demo memakai divisi yang ada: koordinator tidak ikut, izin dari aturan ask, satu gagal", () => {
    const list = [
      division("lead", { role: "coordinator" }),
      division("a"),
      division("b", {
        permission: {
          read: "allow",
          edit: "workspace",
          bash: { allow: [], ask: ["deploy now*"], deny: [] },
          webfetch: "allow",
        },
      }),
      division("c"),
    ];
    const plan = buildDemoPlan(list);
    expect(plan.map((s) => s.divisionId).sort()).toEqual(["a", "b", "c"]);
    expect(plan.find((s) => s.divisionId === "b")?.approval).toBe("deploy now");
    expect(plan.find((s) => s.divisionId === "a")?.title).toBe("Deskripsi a");
    expect(plan.filter((s) => s.fails)).toHaveLength(1);
    expect(plan.find((s) => s.fails)?.divisionId).not.toBe("b");
  });

  it("demo dengan divisi tanpa aturan ask tidak meminta izin", () => {
    const plan = buildDemoPlan([division("x"), division("y")]);
    expect(plan.some((s) => s.approval)).toBe(false);
    expect(plan.some((s) => s.fails)).toBe(false);
  });

  it("profil kantor dari .env, dengan nilai bawaan yang aman", () => {
    expect(
      getHouseProfile({
        HOUSE_NAME: "Kantor Kita",
        HOUSE_LATITUDE: "1.5",
        HOUSE_LONGITUDE: "abc",
      }),
    ).toMatchObject({
      name: "Kantor Kita",
      latitude: 1.5,
      longitude: 107.619,
    });
    expect(getHouseProfile({}).city).toBe("Bandung");
  });
});
