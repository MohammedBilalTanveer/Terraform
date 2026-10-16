// Intro part 1: an ordinary morning street (Kenney city/urban pieces). The player walks to college;
// a hooded stranger steps out of an alley. During the glitch the whole street sinks and dissolves.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { KModel, type ModelKey } from "../game/assets";
import MiniCharacter, { type ClipPlay } from "../game/MiniCharacter";
import { SkyDome } from "../game/WorldScene";
import { distForAspect, fovForAspect } from "../game/useViewport";

export type StreetPhase = "walk" | "encounter" | "game" | "taunt" | "glitch";

const STOP_Z = -4;
const STRANGER = { x: 1.5, z: STOP_Z - 2.2 };
const HOUSES: ModelKey[] = ["houseA", "houseB", "houseC", "houseD", "houseE", "houseF", "houseG", "houseH"];

function Hood() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1d1f2b", roughness: 0.9, side: THREE.DoubleSide }), []);
  return (
    <group>
      {/* hood shell open toward the face (+z) */}
      <mesh material={mat} position={[0, 0.5, -0.01]} scale={[1.08, 1.12, 1.1]} castShadow>
        <sphereGeometry args={[0.215, 18, 12, (3 * Math.PI) / 4, (3 * Math.PI) / 2, 0, Math.PI * 0.72]} />
      </mesh>
      {/* cloak */}
      <mesh material={mat} position={[0, 0.2, -0.01]} castShadow>
        <coneGeometry args={[0.24, 0.42, 14, 1, true]} />
      </mesh>
      <pointLight position={[0, 0.5, 0.25]} color="#8b5cf6" intensity={0.6} distance={1.2} />
    </group>
  );
}

export default function StreetScene({ phase, reduceMotion }: { phase: StreetPhase; reduceMotion: boolean }) {
  const player = useRef<THREE.Group>(null);
  const stranger = useRef<THREE.Group>(null);
  const world = useRef<THREE.Group>(null);
  const pz = useRef(16);
  const sx = useRef(5.2);
  const glitchT = useRef(0);
  const look = useRef(new THREE.Vector3(0, 1, 10));
  const { camera, scene, size } = useThree();

  const [arrived, setArrived] = useState(false);
  const [stepping, setStepping] = useState(false);
  useEffect(() => {
    scene.fog = new THREE.Fog("#cfd9e6", 30, 90);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  const playerClip: ClipPlay = phase === "walk" ? { name: "walk" } : phase === "glitch" ? { name: "emote-no", mode: "loop" } : { name: "idle" };
  const strangerWalking = stepping && !arrived;
  const strangerClip: ClipPlay = strangerWalking ? { name: "walk" } : phase === "game" ? { name: "interact-right", mode: "loop", timeScale: 0.6 } : { name: "idle" };

  const houses = useMemo(() => {
    const out: { model: ModelKey; x: number; z: number; rot: number }[] = [];
    let i = 0;
    for (let z = 22; z > -46; z -= 6.5) {
      out.push({ model: HOUSES[i % HOUSES.length], x: -8.2, z, rot: Math.PI / 2 });
      // leave the alley the stranger steps out of
      if (Math.abs(z - STRANGER.z) > 3) out.push({ model: HOUSES[(i + 3) % HOUSES.length], x: 8.2, z, rot: -Math.PI / 2 });
      i++;
    }
    return out;
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (phase === "walk") pz.current = Math.max(STOP_Z, pz.current - dt * 1.9);
    else pz.current = STOP_Z;
    const go = phase !== "walk" || pz.current < STOP_Z + 3;
    if (go && !stepping) setStepping(true);
    if (go) sx.current = Math.max(STRANGER.x, sx.current - dt * 1.6);
    if (go && !arrived && sx.current <= STRANGER.x + 0.01) setArrived(true);
    if (player.current) {
      player.current.position.set(-0.6, 0, pz.current);
      const toStranger = Math.atan2(STRANGER.x + 0.6, STRANGER.z - pz.current);
      player.current.rotation.y = phase === "walk" ? Math.PI : toStranger;
    }
    if (stranger.current) {
      stranger.current.position.set(sx.current, 0, STRANGER.z);
      stranger.current.rotation.y = sx.current > STRANGER.x + 0.05 ? -Math.PI / 2 : Math.atan2(-0.6 - STRANGER.x, pz.current - STRANGER.z);
      stranger.current.visible = phase !== "walk" || pz.current < STOP_Z + 6;
    }
    // camera: follow from behind while walking, then frame both characters
    // adapt FOV + distance to the live aspect ratio so player and stranger stay framed in portrait and landscape
    const aspect = size.width / Math.max(1, size.height);
    const pc = camera as THREE.PerspectiveCamera;
    const fov = fovForAspect(45, aspect, 72);
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov = fov;
      pc.updateProjectionMatrix();
    }
    const dk = distForAspect(aspect);
    let pos: THREE.Vector3;
    let tgt: THREE.Vector3;
    if (phase === "walk") {
      pos = new THREE.Vector3(2.6 * dk, 3.1 + (dk - 1) * 2, pz.current + 6.2 * dk);
      tgt = new THREE.Vector3(-0.4, 1.1, pz.current - 2.5);
    } else {
      pos = new THREE.Vector3(-2.4 * dk, 2.3 + (dk - 1) * 1.5, pz.current + 3.6 * dk);
      tgt = new THREE.Vector3((STRANGER.x - 0.6) / 2, 1.05, (STRANGER.z + pz.current) / 2);
    }
    const k = 1 - Math.exp(-dt * (phase === "walk" ? 3 : 2.6));
    camera.position.lerp(pos, k);
    look.current.lerp(tgt, k);
    camera.lookAt(look.current);
    // glitch: the street sinks and squashes away
    if (phase === "glitch") glitchT.current = Math.min(1, glitchT.current + dt / 2.4);
    if (world.current) {
      const g = glitchT.current;
      world.current.scale.set(1, Math.max(0.001, 1 - g * g), 1);
      world.current.position.y = -g * 1.5;
      if (!reduceMotion && g > 0) world.current.position.x = (Math.random() - 0.5) * 0.15 * g;
    }
  });

  return (
    <>
      <SkyDome top="#6f9fd8" mid="#f4d6b8" bottom="#e9c6a3" />
      <hemisphereLight args={["#e6efff", "#8a7a6a", 1.0]} />
      <directionalLight position={[10, 18, 6]} intensity={2.4} color="#fff1dc" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <group ref={world}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -10]} receiveShadow>
          <planeGeometry args={[80, 120]} />
          <meshLambertMaterial color="#7d9b5a" />
        </mesh>
        {/* road + sidewalks (simple primitives; Kenney pieces dress the street) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -10]} receiveShadow>
          <planeGeometry args={[6, 120]} />
          <meshLambertMaterial color="#4a4d55" />
        </mesh>
        {Array.from({ length: 24 }).map((_, i) => (
          <mesh key={`d${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 24 - i * 5]}>
            <planeGeometry args={[0.18, 2.2]} />
            <meshBasicMaterial color="#e8e2c8" />
          </mesh>
        ))}
        {[-4.6, 4.6].map((x) => (
          <group key={`sw${x}`}>
            <mesh position={[x, 0.09, -10]} receiveShadow>
              <boxGeometry args={[3.2, 0.18, 120]} />
              <meshLambertMaterial color="#bfb8ac" />
            </mesh>
            <mesh position={[x + (x < 0 ? 1.62 : -1.62), 0.11, -10]}>
              <boxGeometry args={[0.12, 0.22, 120]} />
              <meshLambertMaterial color="#d9d3c6" />
            </mesh>
          </group>
        ))}
        {houses.map((h, i) => (
          <KModel key={`h${i}`} model={h.model} position={[h.x, 0, h.z]} rotation={h.rot} scale={3.4} />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <group key={`l${i}`}>
            <KModel model="streetLight" position={[-5.6, 0.18, 18 - i * 10]} rotation={Math.PI / 2} scale={3.4} />
            <KModel model="parkTree" position={[5.7, 0.18, 14 - i * 10]} scale={2.2} />
          </group>
        ))}
        <KModel model="bench" position={[-4.6, 0.18, 6]} rotation={Math.PI / 2} scale={3} />
        <KModel model="dumpster" position={[6.4, 0, STRANGER.z - 3.2]} rotation={-Math.PI / 2} scale={3} />
        <KModel model="truck" position={[1.6, 0, -20]} scale={2} />
        <KModel model="suburbanFence" position={[-6, 0, 1]} rotation={Math.PI / 2} scale={3} />
        <KModel model="planter" position={[-4.2, 0, -12]} scale={3} />
        {/* college gate in the distance */}
        <group position={[0, 0, -44]}>
          {[-3.5, 3.5].map((x) => (
            <mesh key={x} position={[x, 2, 0]} castShadow>
              <boxGeometry args={[0.8, 4, 0.8]} />
              <meshStandardMaterial color="#c9b79a" />
            </mesh>
          ))}
          <mesh position={[0, 4.2, 0]}>
            <boxGeometry args={[8, 0.7, 0.6]} />
            <meshStandardMaterial color="#8b2f2f" />
          </mesh>
        </group>
        <group ref={player} scale={2}>
          <MiniCharacter model="player" clip={playerClip} />
        </group>
        <group ref={stranger} scale={2.05} position={[5.2, 0, STRANGER.z]}>
          <MiniCharacter model="stranger" clip={strangerClip} tint="#3a3d4f" />
          <Hood />
        </group>
        {/* a couple of distant pedestrians */}
        <group position={[-4.4, 0, -16]} rotation={[0, 0.4, 0]} scale={2}>
          <MiniCharacter model="walkerA" clip={{ name: "idle" }} />
        </group>
        <group position={[4.6, 0, -26]} rotation={[0, -0.6, 0]} scale={2}>
          <MiniCharacter model="walkerB" clip={{ name: "idle" }} />
        </group>
      </group>
    </>
  );
}
