import { describe, expect, it } from "vitest";
import { lightingFor, phaseOf, weatherFrom, worshipUntil } from "./environment.ts";

const day = (h: number, m = 0, date = "2026-10-08") => {
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m);
  return d;
};

describe("waktu", () => {
  it("pagi, siang, sore, malam", () => {
    expect(phaseOf(day(6))).toBe("pagi");
    expect(phaseOf(day(12))).toBe("siang");
    expect(phaseOf(day(16, 30))).toBe("sore");
    expect(phaseOf(day(20))).toBe("malam");
    expect(phaseOf(day(3))).toBe("malam");
  });

  it("malam dan hujan menyalakan lampu", () => {
    expect(lightingFor("malam", "cerah").lamps).toBe(true);
    expect(lightingFor("siang", "hujan").lamps).toBe(true);
    expect(lightingFor("siang", "cerah").lamps).toBe(false);
    expect(lightingFor("siang", "hujan").sun).toBeLessThan(lightingFor("siang", "cerah").sun);
  });
});

describe("cuaca", () => {
  it("dari kode WMO dan suhu", () => {
    expect(weatherFrom(63, 25)).toBe("hujan");
    expect(weatherFrom(95, 30)).toBe("hujan");
    expect(weatherFrom(1, 31)).toBe("panas");
    expect(weatherFrom(3, 19)).toBe("dingin");
    expect(weatherFrom(0, 25)).toBe("cerah");
  });
});

describe("jadwal ibadah", () => {
  it("salat lima waktu", () => {
    expect(worshipUntil("islam", day(12, 0))).toBe(day(12, 10).getTime());
    expect(worshipUntil("islam", day(13, 0))).toBeNull();
    expect(worshipUntil("islam", day(18, 0))).not.toBeNull();
  });

  it("Minggu pagi untuk gereja, bukan hari lain", () => {
    expect(worshipUntil("protestan", day(8, 0, "2026-10-11"))).not.toBeNull(); // Minggu
    expect(worshipUntil("protestan", day(8, 0, "2026-10-08"))).toBeNull(); // Kamis
    expect(worshipUntil("katolik", day(7, 15, "2026-10-11"))).not.toBeNull();
  });

  it("Tri Sandhya, puja, dan sembahyang pagi", () => {
    expect(worshipUntil("hindu", day(18, 5))).not.toBeNull();
    expect(worshipUntil("buddha", day(5, 45))).not.toBeNull();
    expect(worshipUntil("konghucu", day(6, 35))).not.toBeNull();
    expect(worshipUntil(undefined, day(12, 0))).toBeNull();
  });
});
