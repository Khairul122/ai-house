import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { AgentStatus, Dispatch } from "../../state/reduce.ts";
import { office } from "../../state/store.ts";
import { useAgentStatus } from "../../state/useAgentStatus.ts";
import { deskOf, insideOf, randomInRoom, ROOMS, roomById, seatOf, SPOTS, standOf, toCorridor, type Vec2 } from "./layout.ts";
import { type Accessory, lookOf, MAT } from "./looks.ts";
import { Box } from "./parts.tsx";
import { buildPath, zoneAt, type Zone } from "./walk.ts";

const SPEED = 1.8;
const PANTS = "#3A3A40";
const SHOE = "#2A2522";

interface Goal {
  key: string;
  zone: Zone;
  at: Vec2;
  pose: "sit" | "stand";
  face?: number;
}

const angleTo = (from: Vec2, to: Vec2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const jitter = (p: Vec2, r = 0.35): Vec2 => [p[0] + (Math.random() - 0.5) * r * 2, p[1] + (Math.random() - 0.5) * r * 2];

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
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const folder = useRef<Group>(null);
  const bang = useRef<Group>(null);

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
      nextIdle: Date.now() + Math.random() * 5000,
      idleCount: 0,
      lastStatus: "idle" as AgentStatus,
      carrying: null as Dispatch | null,
      handoverAt: 0
    }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: dibuat sekali per karakter
    []
  );

  const sitGoal = (key: string): Goal => ({ key, zone: id, at: seat, pose: "sit", face: faceDesk });

  const pickIdle = (): Goal => {
    const n = `idle-${brain.idleCount++}`;
    if (reducedMotion) return sitGoal(n);
    const r = Math.random();
    if (r < 0.35) return sitGoal(n);
    if (r < 0.6) return { key: n, zone: id, at: randomInRoom(room), pose: "stand" };
    if (r < 0.75) return { key: n, zone: "hall", at: jitter(SPOTS.pantry), pose: "stand", face: Math.PI / 2 };
    if (r < 0.87) return { key: n, zone: "hall", at: jitter(SPOTS.sofa), pose: "stand", face: Math.PI / 2 };
    const other = ROOMS[Math.floor(Math.random() * ROOMS.length)];
    return { key: n, zone: other.id, at: jitter(insideOf(other), 0.25), pose: "stand" };
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
      }
      brain.lastStatus = status;
    }

    // 1. Pilih tujuan dari status asli backend.
    let goal: Goal;
    if (id === "pm" && status !== "waiting" && !brain.carrying && s.dispatches.length > 0) {
      brain.carrying = s.dispatches[0];
      brain.handoverAt = 0;
    }
    if (brain.carrying) {
      const target = roomById(brain.carrying.to);
      goal = target
        ? { key: `deliver-${brain.carrying.taskId}`, zone: target.id, at: insideOf(target), pose: "stand" }
        : sitGoal("deliver-missing");
    } else if (status === "working") goal = sitGoal("work");
    else if (status === "failed") goal = sitGoal("fail");
    else if (status === "waiting") {
      goal = { key: "wait", zone: id, at: standOf(room), pose: "stand", face: toCorridor(room) > 0 ? 0 : Math.PI };
    } else if (status === "done") goal = { ...brain.goal, pose: "stand" };
    else {
      if (!brain.idle || now > brain.nextIdle) {
        brain.idle = pickIdle();
        brain.nextIdle = now + 8000 + Math.random() * 9000;
      }
      goal = brain.idle;
    }

    if (goal.key !== brain.goal.key) {
      brain.path = buildPath(zoneAt(brain.x, brain.z), goal.zone, goal.at);
    }
    brain.goal = goal;

    // 2. Berjalan menyusuri titik rute.
    const moving = brain.path.length > 0;
    if (moving) {
      const [tx, tz] = brain.path[0];
      const dx = tx - brain.x;
      const dz = tz - brain.z;
      const dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
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

    // Serah-terima map tugas oleh PM.
    if (brain.carrying && !moving && goal.key.startsWith("deliver")) {
      if (!brain.handoverAt) brain.handoverAt = now + 900;
      else if (now > brain.handoverAt) {
        office.send({ type: "dispatch.delivered", payload: { taskId: brain.carrying.taskId } });
        brain.carrying = null;
      }
    }

    // 3. Pose tubuh.
    let lx = 0;
    let rx = 0;
    let al = 0;
    let ar = 0;
    let alz = 0;
    let arz = 0;
    let hx = 0;
    let bx = 0;
    let y = 0;
    if (moving) {
      const w = Math.sin(t * 9);
      lx = w * 0.6;
      rx = -w * 0.6;
      al = -w * 0.5;
      ar = w * 0.5;
      y = Math.abs(Math.cos(t * 9)) * 0.05;
    } else if (goal.pose === "sit") {
      lx = rx = -Math.PI / 2;
      if (status === "working") {
        al = -1.25 + Math.sin(t * 16) * 0.08;
        ar = -1.25 + Math.sin(t * 16 + 1.7) * 0.08;
        hx = 0.12;
      } else if (status === "failed") {
        al = ar = -0.2;
        hx = 0.5;
        bx = 0.25;
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
    }
    if (brain.carrying && status !== "waiting") ar = moving ? -0.6 : -1.0;

    const k = Math.min(1, dt * 12);
    const ease = (obj: Group | null, axis: "x" | "z", v: number) => {
      if (obj) obj.rotation[axis] += (v - obj.rotation[axis]) * k;
    };
    ease(legL.current, "x", lx);
    ease(legR.current, "x", rx);
    ease(armL.current, "x", al);
    ease(armR.current, "x", ar);
    ease(armL.current, "z", alz);
    ease(armR.current, "z", arz);
    ease(head.current, "x", hx);
    ease(body.current, "x", bx);

    g.position.set(brain.x, y, brain.z);
    let diff = brain.facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 10);

    if (folder.current) folder.current.visible = !!brain.carrying;
    if (bang.current && agent) {
      const fresh = now - agent.changedAt < 3000; // memantul sebentar saat baru muncul, lalu diam
      bang.current.position.y = 1.78 + (fresh && !reducedMotion ? Math.abs(Math.sin(now / 140)) * 0.12 : 0);
    }
  });

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
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
              <group ref={folder} visible={false}>
                <Box p={[0, -0.5, 0.12]} s={[0.05, 0.3, 0.26]} c="#E2C27A" />
              </group>
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
    </group>
  );
}
