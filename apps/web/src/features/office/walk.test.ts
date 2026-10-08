import { describe, expect, it } from "vitest";
import { EXITS, FLOOR_HALF_X, FLOOR_HALF_Z, insideOf, LEISURE, laneOf, PROMENADE_Z, roomById, setRoomOrder, SPOTS } from "./layout.ts";
import { buildPath, zoneAt } from "./walk.ts";

// Titik di dalam jejak gedung tetapi bukan koridor/pintu: rute luar tidak boleh menembusnya.
const insideBuilding = ([x, z]: [number, number]) => Math.abs(x) < FLOOR_HALF_X - 0.5 && Math.abs(z) > 1.5 && Math.abs(z) < FLOOR_HALF_Z;

// denah dibangun dari daftar divisi; di aplikasi daftar ini datang dari /api/divisions
setRoomOrder(["content-creator", "ui-ux-design", "pm", "software-development", "research-content", "data-analyst", "qa-testing", "devops", "infrastructure-network", "cybersecurity"]);

describe("buildPath", () => {
  it("di ruangan yang sama langsung ke tujuan", () => {
    expect(buildPath("pm", "pm", [1, 2])).toEqual([[1, 2]]);
  });

  it("antar ruangan lewat pintu dan koridor", () => {
    const pm = roomById("pm")!;
    const qa = roomById("qa-testing")!;
    expect(buildPath("pm", "qa-testing", [9, 9])).toEqual([insideOf(pm), laneOf(pm), laneOf(qa), insideOf(qa), [9, 9]]);
  });

  it("zona dari posisi fisik", () => {
    const pm = roomById("pm")!;
    expect(zoneAt(pm.x, pm.z)).toBe("pm");
    expect(zoneAt(pm.x, 0)).toBe("hall");
    expect(zoneAt(SPOTS.pantry[0], SPOTS.pantry[1])).toBe("hall");
    expect(zoneAt(-20, 14)).toBe("outside");
    expect(zoneAt(0, 12)).toBe("outside");
  });

  it("ke kolam renang keluar lewat pintu barat dan jalan setapak", () => {
    const pool = LEISURE.find((l) => l.key === "kursi-kolam-0")!.at;
    const path = buildPath("devops", "outside", pool);
    expect(path).toContainEqual(EXITS.west.inner);
    expect(path).toContainEqual([EXITS.west.outer[0], PROMENADE_Z]);
    expect(path.at(-1)).toEqual(pool);
    expect(path.filter(insideBuilding).every((p) => zoneAt(p[0], p[1]) !== "outside")).toBe(true);
  });

  it("pulang dari taman ke kursi kerja masuk lewat pintu timur", () => {
    const pm = roomById("pm")!;
    const path = buildPath("outside", "pm", [pm.x, pm.z], [25, 22]);
    expect(path[0]).toEqual([25, PROMENADE_Z]);
    expect(path).toContainEqual(EXITS.east.inner);
    expect(path.at(-1)).toEqual([pm.x, pm.z]);
  });
});
