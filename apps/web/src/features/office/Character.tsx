import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { type Camera, type Group, type OrthographicCamera, Vector3 } from "three";
import type { AgentStatus, Dispatch } from "../../state/reduce.ts";
import { play, type SoundName } from "../../lib/sound.ts";
import { env } from "../../state/env.ts";
import { office, useDivisions } from "../../state/store.ts";
import { useAgentStatus } from "../../state/useAgentStatus.ts";
import {
  type Act,
  deskOf,
  insideOf,
  LEISURE,
  POOL,
  randomInRoom,
  roomById,
  seatOf,
  SMALL_TALK,
  standOf,
  toCorridor,
  type Vec2,
  WORSHIP_SPOTS,
  type WorshipStyle
} from "./layout.ts";
import { atmo } from "./Atmosphere.tsx";
import { type Religion, worshipUntil } from "./environment.ts";
import { type Doing, type Emotion, emotionOf, lowestNeed, type Need, simOf, stepNeeds } from "./sims.ts";

// 1 detik nyata = 0,25 menit simulasi: kebutuhan berubah terlihat dalam hitungan menit.
const SIM_MINUTES_PER_SECOND = 0.25;

// Kegiatan santai yang memulihkan tiap kebutuhan.
const RESTORES: Record<Need, Act[]> = {
  energi: ["sleep", "coffee"],
  sosial: ["coffee"],
  hiburan: ["swim", "read", "relax", "stretch"],
  spiritual: ["read", "relax"]
};

const EMOTION_ICONS: Emotion[] = ["senang", "sedih", "kesepian", "lelah", "bosan"];

const ACT_TEXT: Record<string, string> = {
  sleep: "Tidur",
  coffee: "Minum kopi di pantry",
  swim: "Berenang di kolam",
  read: "Membaca di Taman Baca",
  relax: "Bersantai",
  stretch: "Peregangan di taman"
};

const WORSHIP_TEXT: Record<string, string> = {
  salat: "Salat di masjid",
  "doa-duduk": "Berdoa di gereja",
  "doa-katolik": "Berdoa di gereja",
  sembah: "Sembahyang di pura",
  meditasi: "Meditasi di vihara",
  dupa: "Bersembahyang di klenteng"
};
import { type Accessory, lookOf, MAT } from "./looks.ts";
import { Box } from "./parts.tsx";
import { claim, leaveMeet, markArrived, meetOf, placeIn, proposeChat, releaseAll, setAvailable, turnOf } from "./social.ts";
import { buildPath, type Zone, zoneAt } from "./walk.ts";

const SPEED = 1.8;
const PANTS = "#3A3A40";
const SHOE = "#2A2522";

type Pose = "sit" | "stand" | "lie" | "swim";

interface Goal {
  key: string;
  zone: Zone;
  at: Vec2;
  pose: Pose;
  face?: number;
  act?: Act | "chat" | "worship";
  style?: WorshipStyle;
}

const v3 = new Vector3();
// Seberapa keras suara karakter terdengar: hanya bila tampak di layar dan kamera cukup dekat.
function audibility(camera: Camera, x: number, z: number) {
  v3.set(x, 1, z).project(camera);
  if (Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) return 0;
  return Math.min(1, Math.max(0, ((camera as OrthographicCamera).zoom - 12) / 35));
}

// Satu bunyi pembuka per tempat ibadah per sesi, bukan satu per jamaah.
const buildingRang = new Map<string, number>();
const BUILDING_SOUND: Record<string, SoundName | null> = {
  masjid: null, // tanpa tiruan azan, demi hormat
  "gereja-protestan": "bell",
  "gereja-katolik": "bell",
  pura: "chime",
  vihara: "gong",
  klenteng: "gong"
};

const angleTo = (from: Vec2, to: Vec2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const inPool = (x: number, z: number) => Math.abs(x - POOL.x) < POOL.w / 2 && Math.abs(z - POOL.z) < POOL.d / 2;
const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);

function lineFor(id: string, turn: number) {
  const own = SMALL_TALK[id] ?? [];
  const pool = turn % 3 === 2 ? SMALL_TALK.umum : own.length ? own : SMALL_TALK.umum;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return pool[(turn * 7 + h) % pool.length];
}

function HeadGear({ kind, accent, hair, shirt }: { kind: Accessory; accent: string; hair: string; shirt: string }) {
  switch (kind) {
    case "hardhat":
      return (
        <>
          <Box p={[0, 0.43, 0]} s={[0.42, 0.12, 0.42]} c={accent} />
          <Box p={[0, 0.38, 0.04]} s={[0.5, 0.03, 0.52]} c={accent} />
        </>
      );
    case "glasses":
      return <Box p={[0, 0.21, 0.2]} s={[0.33, 0.08, 0.02]} c="#1B1A17" shadow={false} />;
    case "hood":
      return <Box p={[0, 0.2, -0.05]} s={[0.45, 0.45, 0.4]} c={shirt} />;
    case "beret":
      return <Box p={[0.04, 0.42, 0]} s={[0.42, 0.08, 0.42]} c={accent} rotation={[0, 0, 0.18]} />;
    case "headphones":
      return (
        <>
          <Box p={[0, 0.42, 0]} s={[0.46, 0.05, 0.08]} c="#2A2A2A" />
          <Box p={[-0.22, 0.2, 0]} s={[0.08, 0.17, 0.17]} c={accent} />
          <Box p={[0.22, 0.2, 0]} s={[0.08, 0.17, 0.17]} c={accent} />
        </>
      );
    case "cap":
      return (
        <>
          <Box p={[0, 0.41, 0]} s={[0.41, 0.1, 0.41]} c={accent} />
          <Box p={[0, 0.37, 0.26]} s={[0.36, 0.03, 0.16]} c={accent} />
        </>
      );
    case "bun":
      return <Box p={[0, 0.47, -0.1]} s={[0.18, 0.16, 0.18]} c={hair} />;
    case "visor":
      return (
        <>
          <Box p={[0, 0.33, 0]} s={[0.42, 0.07, 0.42]} c={accent} />
          <Box p={[0, 0.31, 0.26]} s={[0.36, 0.03, 0.16]} c={accent} />
        </>
      );
    default:
      return null;
  }
}

interface Props {
  id: string;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

export function Character({ id, reducedMotion, onSelect }: Props) {
  const room = roomById(id)!;
  const look = lookOf(id);
  const { agent, status } = useAgentStatus(id);

  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const folder = useRef<Group>(null);
  const book = useRef<Group>(null);
  const cup = useRef<Group>(null);
  const bang = useRef<Group>(null);
  const talk = useRef<HTMLDivElement>(null);
  const talkAnchor = useRef<Group>(null);
  const talkOn = useRef(false);
  const [talkVisible, setTalkVisible] = useState(false);
  const umbrella = useRef<Group>(null);
  const emotionIcons = useRef<Group>(null);
  const incense = useRef<Group>(null);
  const religion = useDivisions().find((d) => d.id === id)?.religion as Religion | undefined;

  const seat = seatOf(room);
  const faceDesk = angleTo(seat, deskOf(room));
  const brain = useMemo(
    () => ({
      x: seat[0],
      z: seat[1],
      facing: faceDesk,
      path: [] as Vec2[],
      goal: { key: "start", zone: id, at: seat, pose: "sit", face: faceDesk } as Goal,
      idle: null as Goal | null,
      nextIdle: Date.now() + Math.random() * 6000,
      count: 0,
      lastStatus: "idle" as AgentStatus,
      chatting: false,
      worshipCheckAt: 0,
      worshipEnd: null as number | null,
      worshipKey: "",
      rang: "",
      nextSound: 0,
      lastTurn: -1,
      sipping: false,
      carrying: null as Dispatch | null,
      handoverAt: 0
    }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: dibuat sekali per karakter
    []
  );

  const sitGoal = (key: string): Goal => ({ key, zone: id, at: seat, pose: "sit", face: faceDesk });

  // Memilih kegiatan santai berikutnya: kursi kerja, jalan-jalan, ngobrol, atau tempat santai.
  const pickIdle = (now: number): Goal => {
    releaseAll(id);
    const n = `idle-${brain.count++}`;
    if (reducedMotion) return sitGoal(n);
    const r = Math.random();
    if (r < 0.16) return sitGoal(n);
    if (r < 0.26) return { key: n, zone: id, at: randomInRoom(room), pose: "stand" };
    const sim = simOf(id);
    const need = lowestNeed(sim.needs);
    const urgent = sim.needs[need] < 55;
    if (((urgent && need === "sosial") || (!urgent && r < 0.42)) && proposeChat(id, [brain.x, brain.z], now)) return brain.goal; // obrolan diambil alih oleh meetOf
    // hujan: tetap di dalam gedung; dingin: tidak berenang; panas: kolam ramai; malam: lebih banyak tidur
    const w = atmo.weather;
    const night = atmo.phase === "malam";
    const options = LEISURE.filter((l) => {
      if (w === "hujan" && zoneAt(l.at[0], l.at[1]) === "outside") return false;
      if (w === "dingin" && (l.act === "swim" || l.key.startsWith("kursi-kolam"))) return false;
      if (night && l.act === "swim") return false;
      return true;
    }).flatMap((l) => {
      let weight = 1;
      if (w === "panas" && l.act === "swim") weight = 4;
      if (w === "dingin" && l.act === "coffee") weight = 3;
      if (night && l.act === "sleep") weight = 3;
      return Array<typeof l>(weight).fill(l);
    });
    // kebutuhan mendesak: utamakan tempat yang memulihkannya
    const wanted = urgent ? options.filter((l) => RESTORES[need].includes(l.act)) : [];
    for (const spot of [...shuffle(wanted), ...shuffle(options)]) {
      if (!claim(spot.key, id)) continue;
      return { key: `${n}-${spot.key}`, zone: zoneAt(spot.at[0], spot.at[1]), at: spot.at, pose: spot.pose, face: spot.face, act: spot.act };
    }
    return { key: n, zone: id, at: randomInRoom(room), pose: "stand" };
  };

  useFrame(({ clock, camera }, delta) => {
    const g = root.current;
    if (!g) return;
    const now = Date.now();
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const s = office.get();

    if (status !== brain.lastStatus) {
      if (status === "idle") {
        brain.idle = null;
        brain.nextIdle = now + 2000;
      } else {
        leaveMeet(id);
        releaseAll(id);
      }
      brain.lastStatus = status;
    }
    const busyLeisure = brain.goal.act === "sleep" || brain.goal.act === "swim";
    setAvailable(id, status === "idle" && !reducedMotion && !brain.carrying && !busyLeisure && brain.path.length === 0);

    // 1. Pilih tujuan dari status asli backend.
    let goal: Goal;
    if (id === "pm" && status !== "waiting" && !brain.carrying && s.dispatches.length > 0) {
      brain.carrying = s.dispatches[0];
      brain.handoverAt = 0;
      leaveMeet(id);
      releaseAll(id);
    }
    // jadwal ibadah memakai jam simulasi/nyata; dicek sekali per detik
    if (now > brain.worshipCheckAt) {
      brain.worshipCheckAt = now + 1000;
      brain.worshipEnd = worshipUntil(religion, env.now());
    }
    const worshipping = status === "idle" && !brain.carrying && brain.worshipEnd !== null && !!religion;
    if (worshipping) leaveMeet(id);
    const meet = status === "idle" && !brain.carrying && !worshipping ? meetOf(id, now) : undefined;
    if (brain.carrying) {
      const target = roomById(brain.carrying.to);
      goal = target
        ? { key: `deliver-${brain.carrying.taskId}`, zone: target.id, at: insideOf(target), pose: "stand" }
        : sitGoal("deliver-missing");
    } else if (status === "working") goal = sitGoal("work");
    else if (status === "failed") goal = sitGoal("fail");
    else if (status === "waiting") {
      goal = { key: "wait", zone: id, at: standOf(room), pose: "stand", face: toCorridor(room) > 0 ? 0 : Math.PI };
    } else if (status === "done") goal = { ...brain.goal, pose: brain.goal.pose === "sit" ? "sit" : "stand", act: undefined };
    else if (worshipping && religion) {
      const spots = WORSHIP_SPOTS[religion];
      if (!brain.worshipKey) {
        releaseAll(id);
        brain.worshipKey = (spots.find((w) => claim(w.key, id)) ?? spots[0]).key;
        brain.rang = "";
      }
      const w = spots.find((x) => x.key === brain.worshipKey) ?? spots[0];
      goal = { key: `ibadah-${w.key}`, zone: "outside", at: w.at, pose: "stand", face: w.face, act: "worship", style: w.style };
    } else if (meet) {
      const place = placeIn(meet, id);
      goal = { key: meet.key, zone: meet.zone, at: place.at, pose: "stand", face: place.face, act: "chat" };
      brain.chatting = true;
    } else {
      if (brain.worshipKey) {
        brain.worshipKey = "";
        brain.nextIdle = 0; // ibadah selesai: lanjut kegiatan lain
      }
      if (brain.chatting) {
        brain.chatting = false;
        brain.nextIdle = 0; // obrolan selesai: cari kegiatan baru
      }
      if (!brain.idle || now > brain.nextIdle) {
        brain.idle = pickIdle(now);
        const long = brain.idle.act === "sleep" || brain.idle.act === "read";
        brain.nextIdle = now + (long ? 18000 : 9000) + Math.random() * 9000;
      }
      goal = brain.idle;
    }

    if (goal.key !== brain.goal.key) brain.path = buildPath(zoneAt(brain.x, brain.z), goal.zone, goal.at, [brain.x, brain.z]);
    brain.goal = goal;

    // 2. Berjalan menyusuri titik rute.
    const moving = brain.path.length > 0;
    if (moving) {
      const [tx, tz] = brain.path[0];
      const dx = tx - brain.x;
      const dz = tz - brain.z;
      const dist = Math.hypot(dx, dz);
      const e = simOf(id).emotion;
      const mood = e === "sedih" || e === "kesepian" ? 0.7 : e === "lelah" ? 0.75 : e === "senang" ? 1.15 : 1;
      const step = SPEED * mood * (inPool(brain.x, brain.z) ? 0.5 : 1) * dt;
      if (dist <= step) {
        brain.x = tx;
        brain.z = tz;
        brain.path.shift();
      } else {
        brain.x += (dx / dist) * step;
        brain.z += (dz / dist) * step;
      }
      if (dist > 0.01) brain.facing = Math.atan2(dx, dz);
    } else if (goal.face !== undefined) {
      brain.facing = goal.face;
    }
    if (meet && !moving) markArrived(meet, id, now);

    // Serah-terima map tugas oleh PM.
    if (brain.carrying && !moving && goal.key.startsWith("deliver")) {
      if (!brain.handoverAt) brain.handoverAt = now + 900;
      else if (now > brain.handoverAt) {
        office.send({ type: "dispatch.delivered", payload: { taskId: brain.carrying.taskId } });
        brain.carrying = null;
      }
    }

    // 3. Pose tubuh.
    const swimming = inPool(brain.x, brain.z);
    const pose: Pose = swimming ? "swim" : moving ? "stand" : goal.pose;
    const act = moving ? undefined : goal.act;
    let lx = 0;
    let rx = 0;
    let al = 0;
    let ar = 0;
    let alz = 0;
    let arz = 0;
    let hx = 0;
    let hy = 0;
    let bx = 0;
    let y = 0;
    let tiltX = 0;
    let lift = 0;

    const outside = zoneAt(brain.x, brain.z) === "outside";
    if (act === "worship") {
      const style = goal.style;
      const c = (t + id.length * 1.7) % 20; // tiap jamaah sedikit berbeda irama
      const kneel = () => {
        lift = -0.22;
        lx = rx = 1.4;
      };
      const ground = () => {
        lift = -0.32;
        lx = rx = -1.5;
      };
      if (style === "salat") {
        const step = c % 16;
        if (step < 4) {
          al = ar = -1.15; // berdiri, tangan bersedekap
          alz = 0.55;
          arz = -0.55;
        } else if (step < 7) {
          bx = 1.35; // rukuk
          al = ar = -0.35;
          hx = -0.2;
        } else if (step < 9) {
          // iktidal: berdiri tegak
        } else if (step < 12 || step >= 14) {
          kneel(); // sujud
          bx = 1.45;
          al = ar = -1.3;
          hx = 0.3;
        } else {
          kneel(); // duduk di antara dua sujud
          al = ar = -0.5;
        }
      } else if (style === "doa-duduk" || (style === "doa-katolik" && c < 12)) {
        lx = rx = -Math.PI / 2; // duduk di bangku, tangan terkatup, kepala tertunduk
        al = ar = -1.0;
        alz = 0.45;
        arz = -0.45;
        hx = 0.35;
      } else if (style === "doa-katolik") {
        kneel(); // berlutut
        al = ar = -1.3;
        alz = 0.45;
        arz = -0.45;
        hx = 0.25;
      } else if (style === "sembah") {
        ground(); // duduk bersila, tangan terkatup di atas kepala
        const down = c % 6 > 4;
        al = ar = down ? -1.2 : -2.75;
        alz = 0.35;
        arz = -0.35;
        hx = down ? 0.2 : -0.1;
      } else if (style === "meditasi") {
        ground(); // bersila, tangan di pangkuan, sesekali bersujud
        al = ar = -0.6;
        alz = 0.5;
        arz = -0.5;
        bx = c % 10 > 8 ? 0.9 : 0;
        hx = 0.15;
      } else if (style === "dupa") {
        al = ar = -1.2; // memegang dupa di depan dada, membungkuk tiga kali
        alz = 0.5;
        arz = -0.5;
        const b = c % 8;
        bx = (b > 2 && b < 3) || (b > 4 && b < 5) || (b > 6 && b < 7) ? 0.6 : 0;
      }
    } else if (pose === "swim") {
      tiltX = Math.PI / 2;
      lift = 0.12;
      lx = Math.sin(t * 10) * 0.35;
      rx = -lx;
      hx = -0.9; // kepala menengadah di atas air
    } else if (pose === "lie") {
      tiltX = -Math.PI / 2;
      lift = 0.48;
      hx = act === "sleep" ? 0 : -0.25;
      al = ar = act === "relax" ? -2.6 : 0; // santai: tangan di belakang kepala
      alz = act === "relax" ? 0.6 : 0;
      arz = act === "relax" ? -0.6 : 0;
      bx = act === "sleep" ? Math.sin(t * 1.2) * 0.02 : 0; // napas pelan
    } else if (moving) {
      const w = Math.sin(t * 9);
      lx = w * 0.6;
      rx = -w * 0.6;
      al = -w * 0.5;
      ar = w * 0.5;
      y = Math.abs(Math.cos(t * 9)) * 0.05;
    } else if (pose === "sit") {
      lx = rx = -Math.PI / 2;
      if (status === "working") {
        al = -1.25 + Math.sin(t * 16) * 0.08;
        ar = -1.25 + Math.sin(t * 16 + 1.7) * 0.08;
        hx = 0.12;
      } else if (status === "failed") {
        al = ar = -0.2;
        hx = 0.5;
        bx = 0.25;
      } else if (act === "read") {
        al = ar = -1.0;
        hx = 0.35;
      } else {
        al = ar = -0.15;
      }
    } else if (status === "waiting") {
      ar = -2.9;
      arz = -0.15 + Math.sin(t * 4) * 0.1;
    } else if (status === "done") {
      al = ar = -2.8;
      alz = 0.25;
      arz = -0.25;
      y = Math.abs(Math.sin(t * 7)) * 0.12;
    } else if (act === "chat" && meet) {
      const turn = turnOf(meet, now);
      if (turn?.speaker === id) {
        al = -0.5 + Math.sin(t * 5) * 0.35; // bicara sambil bergerak tangan
        ar = -0.4 + Math.sin(t * 4 + 1) * 0.3;
        hy = Math.sin(t * 2) * 0.1;
      } else if (turn) {
        hx = Math.max(0, Math.sin(t * 3)) * 0.15; // mengangguk mendengarkan
      }
    } else if (act === "coffee") {
      const sip = Math.sin(t * 0.8 + id.length) > 0.85;
      ar = sip ? -2.2 : -0.7;
      hx = sip ? -0.2 : 0;
    } else if (act === "stretch") {
      const k = (Math.sin(t * 1.6) + 1) / 2;
      al = ar = -0.3 - k * 2.7;
      alz = 0.3 * k;
      arz = -0.3 * k;
      y = k * 0.05;
    } else if (act === "read") {
      al = ar = -1.0;
      hx = 0.3;
    } else if (atmo.weather === "panas" && outside && !moving) {
      al = -1.9 + Math.sin(t * 9) * 0.25; // mengipas karena gerah
      alz = 0.6;
    } else if (atmo.weather === "dingin" && !moving && pose === "stand") {
      al = ar = -1.35; // bersedekap menahan dingin
      alz = 0.9;
      arz = -0.9;
    }
    // payung saat hujan di luar gedung, kecuali berbaring, berenang, atau beribadah
    const umbrellaOn = outside && atmo.rain > 0.4 && pose !== "lie" && pose !== "swim" && act !== "worship";
    if (umbrellaOn) ar = -2.0;
    if (brain.carrying && status !== "waiting") ar = moving ? -0.6 : -1.0;

    // ---------- simulasi kebutuhan dan emosi ----------
    const sim = simOf(id);
    const doing: Doing =
      act === "worship"
        ? "ibadah"
        : status === "working" && !moving
          ? "kerja"
          : moving
            ? "jalan"
            : act === "sleep"
              ? "tidur"
              : act === "coffee"
                ? "kopi"
                : act === "chat" && meet && turnOf(meet, now)
                  ? "ngobrol"
                  : act === "swim"
                    ? "berenang"
                    : act === "read"
                      ? "membaca"
                      : act === "relax" || act === "stretch"
                        ? "taman"
                        : "diam";
    sim.needs = stepNeeds(sim.needs, doing, dt * SIM_MINUTES_PER_SECOND);
    const emotion = emotionOf(sim.needs, status, doing);
    sim.emotion = emotion;
    sim.activity = brain.carrying
      ? `Mengantar map tugas ke ${lookOf(brain.carrying.to).name}`
      : status === "working"
        ? `Mengerjakan "${agent?.task?.title ?? "tugas"}"`
        : status === "waiting"
          ? "Menunggu izin untuk melanjutkan"
          : status === "failed"
            ? "Memikirkan tugas yang gagal"
            : act === "worship" && goal.style
              ? WORSHIP_TEXT[goal.style]
              : act === "chat" && meet
                ? `Ngobrol dengan ${lookOf(meet.a === id ? meet.b : meet.a).name}`
                : act === "sleep"
                  ? pose === "lie" && goal.at[1] < 5
                    ? "Tidur siang di sofa"
                    : "Tidur di kursi berjemur"
                  : act && ACT_TEXT[act]
                    ? ACT_TEXT[act]
                    : moving
                      ? "Berjalan"
                      : "Santai di ruangannya";

    // bahasa tubuh sesuai emosi (hanya saat tidak sedang melakukan sesuatu yang khusus)
    const free = !act && !moving && pose === "stand" && status === "idle";
    if (emotion === "sedih" || emotion === "kesepian") hx = Math.max(hx, 0.4);
    if (emotion === "lelah") bx = Math.max(bx, 0.15);
    if (free && emotion === "senang" && Math.sin(t * 2.1 + id.length) > 0.92) y = 0.18; // lompat kecil
    if (free && (emotion === "bosan" || emotion === "lelah") && Math.sin(t * 0.9 + id.length) > 0.93) {
      al = ar = -2.8; // menguap sambil meregang
      hx = -0.4;
    }

    const k = Math.min(1, dt * 10);
    const ease = (obj: Group | null, axis: "x" | "y" | "z", v: number) => {
      if (obj) obj.rotation[axis] += (v - obj.rotation[axis]) * k;
    };
    ease(legL.current, "x", lx);
    ease(legR.current, "x", rx);
    ease(head.current, "x", hx);
    ease(head.current, "y", hy);
    ease(body.current, "x", bx);
    ease(tilt.current, "x", tiltX);
    if (pose === "swim" && armL.current && armR.current) {
      // gaya bebas: lengan berputar penuh, bukan ditarik ke satu sudut
      armL.current.rotation.x = -((t * 4) % (Math.PI * 2));
      armR.current.rotation.x = -((t * 4 + Math.PI) % (Math.PI * 2));
      armL.current.rotation.z = armR.current.rotation.z = 0;
    } else {
      ease(armL.current, "x", al);
      ease(armR.current, "x", ar);
      ease(armL.current, "z", alz);
      ease(armR.current, "z", arz);
    }
    if (tilt.current) tilt.current.position.y += (lift - tilt.current.position.y) * k;

    g.position.set(brain.x, y, brain.z);
    let diff = brain.facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 10);

    if (folder.current) folder.current.visible = !!brain.carrying;
    if (book.current) book.current.visible = act === "read" && !brain.carrying;
    if (cup.current) cup.current.visible = act === "coffee" && !brain.carrying;
    if (umbrella.current) umbrella.current.visible = umbrellaOn;
    const icons = emotionIcons.current;
    if (icons) {
      const showIcon = status !== "waiting" && !(act === "chat") && !(act === "sleep" && pose === "lie") && pose !== "swim";
      icons.visible = showIcon;
      icons.position.y = (pose === "lie" ? 1.0 : 2.05) + Math.sin(t * 2) * 0.04;
      icons.position.z = pose === "lie" ? -1.15 : 0;
      icons.children.forEach((c, i) => {
        c.visible = EMOTION_ICONS[i] === emotion;
      });
      icons.rotation.y = -g.rotation.y + Math.PI / 4; // selalu menghadap kamera bawaan
    }
    if (incense.current) incense.current.visible = act === "worship" && goal.style === "dupa";

    // suara interaksi, hanya bila karakter terlihat dan kamera cukup dekat
    const vol = audibility(camera, brain.x, brain.z);
    if (vol > 0) {
      if (act === "worship" && brain.rang !== goal.key) {
        brain.rang = goal.key;
        const w = religion ? WORSHIP_SPOTS[religion].find((x) => x.key === brain.worshipKey) : undefined;
        const sound = w ? BUILDING_SOUND[w.building] : null;
        if (w && sound && now - (buildingRang.get(w.building) ?? 0) > 60_000) {
          buildingRang.set(w.building, now);
          play(sound, vol);
        }
      }
      if (act === "chat" && meet) {
        const turn = turnOf(meet, now);
        if (turn && turn.turn !== brain.lastTurn) {
          brain.lastTurn = turn.turn;
          if (turn.speaker === id) play("chat", vol);
        }
      }
      if (act === "coffee") {
        const sipping = ar < -1.8;
        if (sipping && !brain.sipping) play("sip", vol);
        brain.sipping = sipping;
      }
      if (now > brain.nextSound) {
        if (status === "working" && !moving) play("type", vol * 0.6);
        else if (pose === "swim") play("splash", vol);
        else if (act === "sleep" && pose === "lie") play("snore", vol);
        else if (act === "read" && !moving) play("page", vol * 0.8);
        brain.nextSound = now + (status === "working" ? 1400 : pose === "swim" ? 2400 : act === "sleep" ? 4500 : 7000) + Math.random() * 900;
      }
    }
    if (bang.current && agent) {
      const fresh = now - agent.changedAt < 3000; // memantul sebentar saat baru muncul, lalu diam
      bang.current.position.y = 1.78 + (fresh && !reducedMotion ? Math.abs(Math.sin(now / 140)) * 0.12 : 0);
    }

    // Gelembung obrolan / tidur. Elemen HTML hanya dipasang saat ada teks (HTML di kanvas
    // dihitung ulang posisinya tiap frame), isinya diubah langsung tanpa render ulang React.
    let text = "";
    if (act === "chat" && meet) {
      const turn = turnOf(meet, now);
      if (turn?.speaker === id) text = lineFor(id, turn.turn);
    } else if (act === "sleep" && pose === "lie") text = "Zzz";
    if (!!text !== talkOn.current) {
      talkOn.current = !!text;
      setTalkVisible(!!text);
    }
    const el = talk.current;
    if (el) {
      if (el.textContent !== text) el.textContent = text;
      el.className = text === "Zzz" ? "speech speech-sleep" : "speech";
    }
    // berbaring: kepala ada di belakang kaki, jadi gelembung ikut pindah
    talkAnchor.current?.position.set(0, pose === "lie" ? 0.95 : 1.75, pose === "lie" ? -1.15 : 0);
  });

  return (
    <group
      ref={root}
    >
      <group ref={tilt}>
        <mesh
          visible={false}
          position={[0, 0.75, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <boxGeometry args={[0.7, 1.5, 0.6]} />
        </mesh>
        {[legL, legR].map((ref, i) => (
          <group key={i} ref={ref} position={[i ? 0.11 : -0.11, 0.45, 0]}>
            <Box p={[0, -0.21, 0]} s={[0.17, 0.42, 0.19]} c={PANTS} />
            <Box p={[0, -0.41, 0.04]} s={[0.18, 0.07, 0.25]} c={SHOE} />
          </group>
        ))}

        <group ref={body} position={[0, 0.45, 0]}>
          <Box p={[0, 0.25, 0]} s={[0.46, 0.5, 0.28]} c={look.shirt} />
          {look.accessory === "tie" && <Box p={[0, 0.3, 0.145]} s={[0.08, 0.32, 0.02]} c={look.accent} shadow={false} />}
          {look.accessory === "scarf" && <Box p={[0, 0.48, 0]} s={[0.5, 0.1, 0.32]} c={look.accent} />}

          {[armL, armR].map((ref, i) => (
            <group key={i} ref={ref} position={[i ? 0.3 : -0.3, 0.47, 0]}>
              <Box p={[0, -0.19, 0]} s={[0.13, 0.4, 0.13]} c={look.shirt} />
              <Box p={[0, -0.43, 0]} s={[0.11, 0.1, 0.11]} c={look.skin} />
              {i === 1 && (
                <>
                  <group ref={folder} visible={false}>
                    <Box p={[0, -0.5, 0.12]} s={[0.05, 0.3, 0.26]} c="#E2C27A" />
                  </group>
                  <group ref={cup} visible={false}>
                    <Box p={[0, -0.5, 0.08]} s={[0.1, 0.13, 0.1]} c="#F4EEDF" />
                  </group>
                  <group ref={incense} visible={false}>
                    {[-0.04, 0, 0.04].map((x) => (
                      <Box key={x} p={[x, -0.5, 0.25]} s={[0.015, 0.015, 0.4]} c="#C8553D" shadow={false} />
                    ))}
                    {[-0.04, 0, 0.04].map((x) => (
                      <Box key={`ujung${x}`} p={[x, -0.5, 0.46]} s={[0.025, 0.025, 0.03]} c="#FF8A4A" emissive="#FF6A2A" glow={1} shadow={false} />
                    ))}
                  </group>
                  <group ref={book} visible={false}>
                    <Box p={[-0.3, -0.5, 0.06]} s={[0.42, 0.06, 0.3]} c={look.accent} rotation={[0.5, 0, 0]} />
                  </group>
                </>
              )}
            </group>
          ))}

          <group ref={head} position={[0, 0.5, 0]}>
            <Box p={[0, 0.19, 0]} s={[0.38, 0.38, 0.38]} c={look.skin} />
            <Box p={[-0.08, 0.21, 0.195]} s={[0.05, 0.06, 0.02]} c="#1B1A17" shadow={false} />
            <Box p={[0.08, 0.21, 0.195]} s={[0.05, 0.06, 0.02]} c="#1B1A17" shadow={false} />
            {look.accessory !== "hood" && (
              <>
                <Box p={[0, 0.37, -0.01]} s={[0.4, 0.08, 0.41]} c={look.hair} />
                <Box p={[0, 0.22, -0.18]} s={[0.4, 0.3, 0.06]} c={look.hair} />
              </>
            )}
            <HeadGear kind={look.accessory} accent={look.accent} hair={look.hair} shirt={look.shirt} />
          </group>
        </group>
      </group>

      {/* ikon emosi di atas kepala, urutan sama dengan EMOTION_ICONS */}
      <group ref={emotionIcons} position={[0, 2.05, 0]}>
        <group>
          {/* senang: hati */}
          <Box p={[-0.07, 0.05, 0]} s={[0.13, 0.13, 0.06]} c="#E5677A" emissive="#E5677A" glow={0.4} shadow={false} />
          <Box p={[0.07, 0.05, 0]} s={[0.13, 0.13, 0.06]} c="#E5677A" emissive="#E5677A" glow={0.4} shadow={false} />
          <Box p={[0, -0.04, 0]} s={[0.14, 0.14, 0.06]} c="#E5677A" emissive="#E5677A" glow={0.4} shadow={false} rotation={[0, 0, Math.PI / 4]} />
        </group>
        <group>
          {/* sedih: tetes air mata */}
          <Box p={[0, -0.03, 0]} s={[0.14, 0.14, 0.06]} c="#5B8DD6" emissive="#5B8DD6" glow={0.4} shadow={false} rotation={[0, 0, Math.PI / 4]} />
          <Box p={[0, 0.09, 0]} s={[0.06, 0.08, 0.06]} c="#5B8DD6" emissive="#5B8DD6" glow={0.4} shadow={false} />
        </group>
        <group>
          {/* kesepian: tetes kecil pucat */}
          <Box p={[0, 0, 0]} s={[0.1, 0.1, 0.06]} c="#9BB3D6" emissive="#9BB3D6" glow={0.3} shadow={false} rotation={[0, 0, Math.PI / 4]} />
        </group>
        <group>
          {/* lelah: baterai hampir habis */}
          <Box p={[0, 0, 0]} s={[0.3, 0.14, 0.05]} c="#3A3A3A" shadow={false} />
          <Box p={[0.17, 0, 0]} s={[0.04, 0.07, 0.05]} c="#3A3A3A" shadow={false} />
          <Box p={[-0.1, 0, 0.01]} s={[0.06, 0.09, 0.05]} c="#D9534F" emissive="#D9534F" glow={0.5} shadow={false} />
        </group>
        <group>
          {/* bosan: tiga titik */}
          {[-0.11, 0, 0.11].map((x) => (
            <Box key={x} p={[x, 0, 0]} s={[0.07, 0.07, 0.05]} c="#8A8A85" shadow={false} />
          ))}
        </group>
      </group>

      <group ref={umbrella} visible={false} position={[0.3, 0, 0]}>
        <Box p={[0, 1.55, 0]} s={[0.04, 1.1, 0.04]} c="#3A3530" shadow={false} />
        <mesh position={[0, 2.12, 0]} castShadow>
          <coneGeometry args={[0.75, 0.32, 8]} />
          <meshStandardMaterial color={look.accent} roughness={0.7} />
        </mesh>
      </group>

      {status === "waiting" && (
        <group ref={bang} position={[0, 1.78, 0]}>
          <Box p={[0, 0.2, 0]} s={[0.1, 0.28, 0.1]} c={MAT.waiting} emissive={MAT.waiting} glow={0.6} shadow={false} />
          <Box p={[0, 0, 0]} s={[0.1, 0.09, 0.1]} c={MAT.waiting} emissive={MAT.waiting} glow={0.6} shadow={false} />
        </group>
      )}

      {status === "working" && agent?.task && (
        <Html position={[0, 1.85, 0]} center zIndexRange={[10, 0]} pointerEvents="none">
          <div className="speech">{agent.task.title}</div>
        </Html>
      )}

      <group ref={talkAnchor} position={[0, 1.75, 0]}>
        {status === "idle" && talkVisible && (
          <Html center zIndexRange={[10, 0]} pointerEvents="none">
            <div ref={talk} className="speech" />
          </Html>
        )}
      </group>
    </group>
  );
}
