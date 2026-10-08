import { describe, expect, it } from "vitest";
import {
  MEETING_W,
  MEETING_X,
  ROOM_W,
  buildRooms,
  meetingSeats,
} from "./layout.ts";

const floor = (id: string, n: number) => ({
  id,
  divisionIds: Array.from({ length: n }, (_, i) => `${id}${i}`),
});

describe("buildRooms", () => {
  it("tiap lantai: divisi di dua deretan, ruang rapat di ujung timur deretan utara", () => {
    const rooms = buildRooms([floor("a", 6)]);
    const divisions = rooms.filter((r) => !r.meeting);
    expect(divisions.filter((r) => r.side === "n").map((r) => r.x)).toEqual([
      -7.5, -2.5, 2.5,
    ]);
    expect(divisions.filter((r) => r.side === "s").map((r) => r.x)).toEqual([
      -7.5, -2.5, 2.5,
    ]);
    expect(divisions.every((r) => r.w === ROOM_W)).toBe(true);
    const meeting = rooms.find((r) => r.meeting)!;
    expect(meeting).toMatchObject({
      id: "rapat:a",
      x: MEETING_X,
      side: "n",
      level: 0,
    });
  });

  it("lantai bertingkat sesuai urutan, id lantai tercatat di ruangan", () => {
    const rooms = buildRooms([floor("a", 2), floor("b", 3), floor("c", 1)]);
    expect(
      rooms.filter((r) => r.floor === "b").every((r) => r.level === 1),
    ).toBe(true);
    expect(rooms.filter((r) => r.meeting).map((r) => r.level)).toEqual([
      0, 1, 2,
    ]);
  });

  it("divisi melebihi kapasitas: ruangan menyempit, tidak menabrak ruang rapat atau lift", () => {
    const rooms = buildRooms([floor("a", 16)]).filter((r) => !r.meeting);
    const w = rooms[0].w;
    expect(w).toBeLessThan(ROOM_W);
    const xs = rooms.filter((r) => r.side === "n").map((r) => r.x);
    for (let i = 1; i < xs.length; i++)
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(w);
    expect(Math.max(...xs) + w / 2).toBeLessThanOrEqual(
      MEETING_X - MEETING_W / 2,
    );
    expect(Math.min(...xs) - w / 2).toBeGreaterThanOrEqual(-12.5);
  });

  it("lantai kosong tetap punya ruang rapat; tanpa lantai denah kosong", () => {
    expect(buildRooms([floor("a", 0)]).map((r) => r.id)).toEqual(["rapat:a"]);
    expect(buildRooms([])).toEqual([]);
  });

  it("delapan kursi rapat di dalam ruang rapat", () => {
    const [room] = buildRooms([floor("a", 0)]);
    const seats = meetingSeats(room);
    expect(seats).toHaveLength(8);
    for (const s of seats)
      expect(Math.abs(s.at[0] - room.x)).toBeLessThan(room.w / 2);
  });
});
