import { describe, expect, it } from "vitest";
import { FileDivisionRepository } from "../src/modules/divisions/infrastructure/file-division.repository.js";
import { getHouseProfile } from "../src/modules/settings/house.js";

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
