import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { AgentStatus, Dispatch } from "../../state/reduce.ts";
import { office } from "../../state/store.ts";
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
  type Vec2
} from "./layout.ts";
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
  act?: Act | "chat";
}

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
    if (r < 0.42 && proposeChat(id, [brain.x, brain.z], now)) return brain.goal; // obrolan diambil alih oleh meetOf
    for (const spot of shuffle(LEISURE)) {
      if (!claim(spot.key, id)) continue;
      return { key: `${n}-${spot.key}`, zone: zoneAt(spot.at[0], spot.at[1]), at: spot.at, pose: spot.pose, face: spot.face, act: spot.act };
    }
    return { key: n, zone: id, at: randomInRoom(room), pose: "stand" };
  };

  useFrame(({ clock }, delta) => {
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
    const meet = status === "idle" && !brain.carrying ? meetOf(id, now) : undefined;
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
    else if (meet) {
      const place = placeIn(meet, id);
      goal = { key: meet.key, zone: meet.zone, at: place.at, pose: "stand", face: place.face, act: "chat" };
      brain.chatting = true;
    } else {
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
      const step = SPEED * (inPool(brain.x, brain.z) ? 0.5 : 1) * dt;
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

    if (pose === "swim") {
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
    }
    if (brain.carrying && status !== "waiting") ar = moving ? -0.6 : -1.0;

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
    if (bang.current && agent) {
      const fresh = now - agent.changedAt < 3000; // memantul sebentar saat baru muncul, lalu diam
      bang.current.position.y = 1.78 + (fresh && !reducedMotion ? Math.abs(Math.sin(now / 140)) * 0.12 : 0);
    }

    // Gelembung obrolan / tidur, diubah langsung tanpa render ulang React.
    const el = talk.current;
    if (el) {
      let text = "";
      if (act === "chat" && meet) {
        const turn = turnOf(meet, now);
        if (turn?.speaker === id) text = lineFor(id, turn.turn);
      } else if (act === "sleep" && pose === "lie") text = "Zzz";
      if (el.textContent !== text) el.textContent = text;
      el.style.display = text ? "" : "none";
      el.className = text === "Zzz" ? "speech speech-sleep" : "speech";
    }
    // berbaring: kepala ada di belakang kaki, jadi gelembung ikut pindah
    talkAnchor.current?.position.set(0, pose === "lie" ? 0.95 : 1.75, pose === "lie" ? -1.15 : 0);
  });

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      <group ref={tilt}>
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

      {status === "idle" && (
        <group ref={talkAnchor} position={[0, 1.75, 0]}>
          <Html center zIndexRange={[10, 0]} pointerEvents="none">
            <div ref={talk} className="speech" style={{ display: "none" }} />
          </Html>
        </group>
      )}
    </group>
  );
}
