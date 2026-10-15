// Player: WASD/arrow movement with acceleration, sprint, circle collision, facing, clip selection
// and the literal farming animations (tool in hand, particles) while an action is running.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import MiniCharacter, { type ClipPlay } from "./MiniCharacter";
import { KModel } from "./assets";
import { ParticleBurst, ScanRings } from "./Effects";
import { readMoveInput } from "./input";
import { resolve } from "./collision";
import { heightAt } from "./terrain";
import { STATIONS, stationById } from "./worldConfig";
import { joystick, playerState, useGame, type ActionKind } from "./gameStore";

const WALK = 4.2;
const SPRINT = 7.4;
const SCALE = 2;

function clipFor(kind: ActionKind, phase: number): ClipPlay {
  switch (kind) {
    case "inspect":
      return { name: "crouch", mode: "once" };
    case "dig":
      return { name: "attack-melee-right", mode: "loop", timeScale: 0.55 };
    case "stones":
      return { name: "pick-up", mode: "pingpong", timeScale: 0.32 };
    case "compost":
      return phase < 0.45 ? { name: "holding-both", mode: "once" } : { name: "interact-right", mode: "loop", timeScale: 0.7 };
    case "sow":
      return { name: "pick-up", mode: "pingpong", timeScale: 0.28 };
    case "water":
      return { name: "holding-right", mode: "once" };
    case "harvest":
      return { name: "pick-up", mode: "pingpong", timeScale: 0.4 };
  }
}

const angleLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export default function PlayerController({ enabled }: { enabled: boolean }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const speedRef = useRef(1);
  const [clip, setClip] = useState<ClipPlay>({ name: "idle" });
  const clipKey = useRef("idle");
  const [fx, setFx] = useState<{ kind: ActionKind | null; phase2: boolean }>({ kind: null, phase2: false });
  const celebrateUntil = useRef(0);
  const lastAction = useRef<number | null>(null);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const g = useGame.getState();
    const action = g.action;
    const now = performance.now();
    const p = playerState;

    // --- input -------------------------------------------------------------------------------
    let ix = 0;
    let iz = 0;
    let sprint = false;
    const canMove = enabled && !action && !g.overlay;
    if (canMove) {
      const k = readMoveInput();
      ix = k.x;
      iz = k.z;
      sprint = k.sprint;
      if (joystick.active) {
        ix += joystick.x;
        iz += joystick.z;
        sprint = sprint || Math.hypot(joystick.x, joystick.z) > 0.92;
      }
    }
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const maxSpeed = sprint ? SPRINT : WALK;
    const tvx = ix * maxSpeed;
    const tvz = iz * maxSpeed;
    const accel = len > 0.01 ? 9 : 12;
    p.vx += (tvx - p.vx) * Math.min(1, accel * dt);
    p.vz += (tvz - p.vz) * Math.min(1, accel * dt);
    const [nx, nz] = resolve(p.x + p.vx * dt, p.z + p.vz * dt);
    // derive effective velocity after collision so animation matches sliding
    const evx = (nx - p.x) / Math.max(dt, 1e-4);
    const evz = (nz - p.z) / Math.max(dt, 1e-4);
    p.x = nx;
    p.z = nz;
    p.y = heightAt(p.x, p.z);
    p.speed = Math.hypot(evx, evz);

    // --- facing --------------------------------------------------------------------------------
    if (action?.station) {
      const s = stationById(action.station).pos;
      const target = Math.atan2(s[0] - p.x, s[1] - p.z);
      p.rot = angleLerp(p.rot, target, Math.min(1, dt * 8));
    } else if (p.speed > 0.3) {
      p.rot = angleLerp(p.rot, Math.atan2(evx, evz), Math.min(1, dt * 12));
    }
    if (group.current) {
      group.current.position.set(p.x, p.y, p.z);
      group.current.rotation.y = p.rot;
    }

    // --- clip selection -----------------------------------------------------------------------
    if (lastAction.current && !action) celebrateUntil.current = now + 750;
    lastAction.current = action ? action.start : null;
    let next: ClipPlay;
    let phase = 0;
    if (action) {
      phase = (now - action.start) / action.duration;
      next = clipFor(action.kind, phase);
    } else if (now < celebrateUntil.current) next = { name: "emote-yes", mode: "once" };
    else if (p.speed > 5.2) next = { name: "sprint" };
    else if (p.speed > 0.35) next = { name: "walk" };
    else next = { name: "idle" };
    speedRef.current = next.name === "sprint" ? p.speed / 6.5 : Math.max(0.5, p.speed / 3.3);
    const key = `${next.name}|${next.mode}|${next.timeScale}`;
    if (key !== clipKey.current) {
      clipKey.current = key;
      setClip(next);
    }
    const fxKind = action?.kind ?? null;
    const phase2 = action?.kind === "compost" ? phase >= 0.45 : true;
    if (fxKind !== fx.kind || phase2 !== fx.phase2) setFx({ kind: fxKind, phase2 });

    // subtle bob for dig strikes (authored on top of the clip)
    if (body.current) {
      body.current.position.y = action?.kind === "dig" ? Math.max(0, Math.sin(now / 140)) * -0.04 : 0;
    }

    // --- proximity ------------------------------------------------------------------------------
    let near: (typeof STATIONS)[number]["id"] | null = null;
    let nearD = Infinity;
    let area: (typeof STATIONS)[number]["id"] | null = null;
    let areaD = Infinity;
    for (const s of STATIONS) {
      const d = Math.hypot(p.x - s.pos[0], p.z - s.pos[1]);
      if (s.interactive && d < s.interactR && d < nearD) {
        near = s.id;
        nearD = d;
      }
      if (d < s.areaR && d < areaD) {
        area = s.id;
        areaD = d;
      }
    }
    if (near !== g.nearStation) g.setNear(near);
    if (area !== g.area) g.setArea(area);
  });

  const k = fx.kind;
  const hand =
    k === "dig" ? (
      <KModel model="shovel" scale={1.5} rotation={[Math.PI, 0, 0]} position={[0, 0.05, 0]} />
    ) : k === "water" ? (
      <KModel model="bucket" scale={1.1} rotation={[0.9, 0, 0]} position={[0, -0.06, 0.04]} />
    ) : k === "compost" && !fx.phase2 ? (
      <KModel model="bucket" scale={1.1} position={[0, -0.12, 0.06]} />
    ) : k === "stones" ? (
      <KModel model="resourceStone" scale={1.3} position={[0, -0.08, 0.03]} />
    ) : null;

  return (
    <group ref={group}>
      <group ref={body} scale={SCALE}>
        <MiniCharacter model="player" clip={clip} speedRef={speedRef} rightHand={hand} />
      </group>
      {k === "dig" && <ParticleBurst active kind="dust" count={36} />}
      {k === "stones" && <ParticleBurst active kind="dust" count={20} />}
      {k === "compost" && fx.phase2 && <ParticleBurst active kind="compost" count={36} />}
      {k === "sow" && <ParticleBurst active kind="seeds" count={34} />}
      {k === "water" && <ParticleBurst active kind="drops" count={46} />}
      {k === "harvest" && <ParticleBurst active kind="sparkle" count={30} />}
      {k === "inspect" && <ScanRings radius={2.2} count={3} speed={1.1} />}
    </group>
  );
}
