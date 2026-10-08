import { env } from "../state/env.ts";

// Semua suara dibuat dengan Web Audio (tanpa berkas audio). Lembut, dan hanya berbunyi bila suara dinyalakan.
// Peramban baru mengizinkan audio setelah pengguna mengklik halaman, jadi konteks dibuat saat klik pertama.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

function ready(): AudioContext | null {
  if (!env.get().sound) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

if (typeof window !== "undefined") window.addEventListener("pointerdown", () => ready(), { passive: true });

function tone(freq: number, dur: number, o: { type?: OscillatorType; vol?: number; delay?: number; to?: number } = {}) {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, o: { vol?: number; freq?: number; type?: BiquadFilterType; delay?: number; swell?: boolean } = {}) {
  const c = ready();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? "lowpass";
  f.frequency.value = o.freq ?? 1000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.15, t + (o.swell ? dur * 0.5 : 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// Lonceng / gong: beberapa nada dengan peluruhan panjang.
function struck(partials: number[], dur: number, vol: number) {
  partials.forEach((f, i) => tone(f, dur * (1 - i * 0.15), { vol: vol / (i + 1) }));
}

export type SoundName =
  | "done"
  | "approval"
  | "fail"
  | "dispatch"
  | "click"
  | "chat"
  | "type"
  | "splash"
  | "snore"
  | "bell"
  | "gong"
  | "tok"
  | "chime"
  | "bird"
  | "cricket"
  | "sip"
  | "page";

export function play(name: SoundName, volume = 1) {
  const v = Math.max(0, Math.min(1, volume));
  if (v < 0.03 || !env.get().sound) return;
  switch (name) {
    case "done":
      [523, 659, 784].forEach((f, i) => tone(f, 0.25, { vol: 0.16 * v, delay: i * 0.09 }));
      break;
    case "approval":
      tone(880, 0.18, { type: "triangle", vol: 0.16 * v });
      tone(660, 0.25, { type: "triangle", vol: 0.16 * v, delay: 0.16 });
      break;
    case "fail":
      tone(240, 0.45, { type: "triangle", vol: 0.14 * v, to: 150 });
      break;
    case "dispatch":
      noise(0.25, { vol: 0.1 * v, freq: 2400, type: "bandpass" });
      break;
    case "click":
      tone(1400, 0.04, { vol: 0.06 * v });
      break;
    case "chat": {
      const base = 260 + Math.random() * 220;
      for (let i = 0; i < 3; i++) tone(base * (0.85 + Math.random() * 0.4), 0.07, { type: "triangle", vol: 0.07 * v, delay: i * 0.09 });
      break;
    }
    case "type":
      for (let i = 0; i < 3; i++) noise(0.03, { vol: 0.05 * v, freq: 3500, type: "highpass", delay: i * 0.07 + Math.random() * 0.03 });
      break;
    case "splash":
      noise(0.5, { vol: 0.14 * v, freq: 900 });
      break;
    case "snore":
      noise(1.4, { vol: 0.08 * v, freq: 260, swell: true });
      break;
    case "bell":
      struck([392, 784.5, 1180, 1570], 3.2, 0.14 * v);
      break;
    case "gong":
      struck([98, 147, 221, 305], 4, 0.18 * v);
      break;
    case "tok":
      tone(720, 0.07, { type: "triangle", vol: 0.12 * v });
      tone(720, 0.07, { type: "triangle", vol: 0.1 * v, delay: 0.28 });
      break;
    case "chime":
      struck([1046, 1568], 1.6, 0.06 * v);
      break;
    case "bird":
      tone(2600, 0.09, { vol: 0.05 * v, to: 3600 });
      tone(3000, 0.08, { vol: 0.04 * v, to: 3900, delay: 0.14 });
      break;
    case "cricket":
      for (let i = 0; i < 4; i++) tone(4300, 0.025, { vol: 0.03 * v, delay: i * 0.05 });
      break;
    case "sip":
      noise(0.18, { vol: 0.04 * v, freq: 1800, type: "bandpass" });
      break;
    case "page":
      noise(0.12, { vol: 0.05 * v, freq: 3000, type: "highpass" });
      break;
  }
}

// Suara hujan terus-menerus selama cuaca hujan dan suara menyala.
export function setRain(on: boolean) {
  const c = on ? ready() : ctx;
  if (on && c && master && noiseBuf && !rain) {
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1400;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 1.5);
    src.connect(f).connect(gain).connect(master);
    src.start();
    rain = { src, gain };
  } else if (!on && rain && ctx) {
    const r = rain;
    rain = null;
    r.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
    r.src.stop(ctx.currentTime + 1.1);
  }
}

// Bunyi untuk event kantor dari server.
export function playEventSound(event: { type: string; payload?: unknown }) {
  const p = (event.payload ?? {}) as { status?: string };
  if (event.type === "approval.created") play("approval");
  else if (event.type === "task.dispatched") play("dispatch", 0.7);
  else if (event.type === "task.updated" && p.status === "done") play("done");
  else if (event.type === "task.updated" && p.status === "failed") play("fail");
}
