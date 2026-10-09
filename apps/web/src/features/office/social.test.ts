import { describe, expect, it } from "vitest";
import {
  claim,
  leaveMeet,
  markArrived,
  meetOf,
  placeIn,
  proposeChat,
  releaseAll,
  setAvailable,
  turnOf,
} from "./social.ts";

describe("social", () => {
  it("ngobrol hanya dengan karakter yang bebas, bergiliran setelah keduanya tiba", () => {
    setAvailable("pm", true);
    expect(proposeChat("pm", [0, 0], 0)).toBeNull(); // belum ada teman bebas

    setAvailable("devops", true);
    const m = proposeChat("pm", [0, 0], 0)!;
    expect(m.b).toBe("devops");
    expect(meetOf("devops", 1)).toBe(m);
    expect(proposeChat("devops", [0, 0], 1)).toBeNull(); // sudah punya janji

    // berdiri berhadapan
    const a = placeIn(m, "pm");
    const b = placeIn(m, "devops");
    expect(b.at[0] - a.at[0]).toBeCloseTo(1.1);
    expect(a.face).toBe(-b.face);

    expect(turnOf(m, 100)).toBeNull();
    markArrived(m, "pm", 100);
    markArrived(m, "devops", 200);
    expect(turnOf(m, 200)?.speaker).toBe("pm");
    expect(turnOf(m, 200 + 2700)?.speaker).toBe("devops");

    expect(meetOf("pm", m.until + 1)).toBeUndefined(); // selesai setelah waktunya habis
    expect(meetOf("devops", m.until + 1)).toBeUndefined();
  });

  it("pergi di tengah obrolan membubarkan pertemuan untuk keduanya", () => {
    setAvailable("qa-testing", true);
    setAvailable("cybersecurity", true);
    const m = proposeChat("qa-testing", [0, 0], 0)!;
    leaveMeet(m.b);
    expect(meetOf(m.a, 1)).toBeUndefined();
  });

  it("satu tempat untuk satu karakter", () => {
    expect(claim("sofa", "pm")).toBe(true);
    expect(claim("sofa", "devops")).toBe(false);
    releaseAll("pm");
    expect(claim("sofa", "devops")).toBe(true);
  });
});
