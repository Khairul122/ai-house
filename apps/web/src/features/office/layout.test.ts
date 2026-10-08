import { describe, expect, it } from "vitest";
import { ROOM_W, buildRooms } from "./layout.ts";

describe("buildRooms", () => {
  it("sepuluh divisi mengisi dua deretan lima ruangan seperti denah gedung", () => {
    const rooms = buildRooms(Array.from({ length: 10 }, (_, i) => `d${i}`));
    expect(rooms.filter((r) => r.side === "n").map((r) => r.x)).toEqual([
      -10, -5, 0, 5, 10,
    ]);
    expect(rooms.filter((r) => r.side === "s").map((r) => r.x)).toEqual([
      -10, -5, 0, 5, 10,
    ]);
    expect(rooms.every((r) => r.w === ROOM_W)).toBe(true);
  });

  it("jumlah ganjil: deretan selatan satu lebih sedikit, kolom tetap sejajar", () => {
    const rooms = buildRooms(["a", "b", "c"]);
    expect(rooms.map((r) => [r.id, r.side, r.x])).toEqual([
      ["a", "n", -2.5],
      ["b", "n", 2.5],
      ["c", "s", -2.5],
    ]);
  });

  it("divisi melebihi kapasitas: ruangan menyempit dan tetap muat di dalam gedung", () => {
    const rooms = buildRooms(Array.from({ length: 16 }, (_, i) => `d${i}`));
    const w = rooms[0].w;
    expect(w).toBeLessThan(ROOM_W);
    const xs = rooms.filter((r) => r.side === "n").map((r) => r.x);
    for (let i = 1; i < xs.length; i++)
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(w);
    expect(Math.max(...xs.map(Math.abs)) + w / 2).toBeLessThanOrEqual(13);
  });

  it("tanpa divisi: denah kosong", () => {
    expect(buildRooms([])).toEqual([]);
  });
});
