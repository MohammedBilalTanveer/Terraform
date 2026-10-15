// Kenney Mini Character with its embedded clips (idle, walk, sprint, crouch, pick-up, interact-right,
// holding-*, attack-melee-right, die, emote-yes, ...). Falls back to a primitive figure.
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODELS, ModelBoundary, type ModelKey } from "./assets";

export type ClipName =
  | "static"
  | "idle"
  | "walk"
  | "sprint"
  | "jump"
  | "fall"
  | "crouch"
  | "sit"
  | "die"
  | "pick-up"
  | "emote-yes"
  | "emote-no"
  | "holding-right"
  | "holding-left"
  | "holding-both"
  | "attack-melee-right"
  | "interact-right"
  | "interact-left";

export type ClipPlay = {
  name: ClipName;
  /** loop = repeat, once = play & hold last frame, pingpong = back and forth */
  mode?: "loop" | "once" | "pingpong";
  timeScale?: number;
  /** play the clip backwards from its end (e.g. "die" reversed = getting up) */
  reverse?: boolean;
};

export const POSE_CLIPS: ClipName[] = ["crouch", "sit", "die", "holding-right", "holding-left", "holding-both", "static"];

type Props = {
  model?: ModelKey;
  clip: ClipPlay;
  /** speed multiplier written by a controller every frame (for walk cadence) */
  speedRef?: { current: number };
  tint?: string;
  /** objects attached to the right arm bone */
  rightHand?: ReactNode;
  children?: ReactNode;
};

function Loaded({ model = "player", clip, speedRef, tint, rightHand }: Props) {
  const gltf = useGLTF(MODELS[model]);
  const scene = useMemo(() => {
    const s = skeletonClone(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
        if (tint) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.color = new THREE.Color(tint);
          m.material = mat;
        }
      }
    });
    return s;
  }, [gltf.scene, tint]);
  const root = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(gltf.animations, root);
  const current = useRef<THREE.AnimationAction | null>(null);
  const arm = useMemo(() => scene.getObjectByName("arm-right") ?? null, [scene]);

  const key = `${clip.name}|${clip.mode}|${clip.reverse}`;
  useEffect(() => {
    const next = actions[clip.name];
    if (!next) return;
    const mode = clip.mode ?? (POSE_CLIPS.includes(clip.name) ? "once" : "loop");
    next.reset();
    next.setLoop(mode === "once" ? THREE.LoopOnce : mode === "pingpong" ? THREE.LoopPingPong : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = mode === "once";
    next.timeScale = (clip.reverse ? -1 : 1) * (clip.timeScale ?? 1);
    if (clip.reverse) next.time = next.getClip().duration;
    const prev = current.current;
    next.play();
    if (prev && prev !== next) prev.crossFadeTo(next, 0.18, false);
    else next.fadeIn(0.15);
    current.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, key]);

  useEffect(() => {
    if (current.current && clip.timeScale !== undefined && !speedRef) current.current.timeScale = (clip.reverse ? -1 : 1) * clip.timeScale;
  }, [clip.timeScale, clip.reverse, speedRef]);

  useFrame(() => {
    if (speedRef && current.current && (clip.name === "walk" || clip.name === "sprint")) {
      current.current.timeScale = speedRef.current;
    }
  });

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  return (
    <group ref={root}>
      <primitive object={scene} />
      {arm && rightHand ? createPortal(<group position={[-0.02, -0.12, 0.02]}>{rightHand}</group>, arm) : null}
    </group>
  );
}

const fbBody = new THREE.MeshStandardMaterial({ color: "#3b82c4", flatShading: true });
const fbSkin = new THREE.MeshStandardMaterial({ color: "#e0b48a", flatShading: true });

function FallbackFigure({ tint }: { tint?: string }) {
  const body = useMemo(() => (tint ? new THREE.MeshStandardMaterial({ color: tint, flatShading: true }) : fbBody), [tint]);
  return (
    <group>
      <mesh material={body} position={[0, 0.25, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.18, 3, 8]} />
      </mesh>
      <mesh material={fbSkin} position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.13, 10, 8]} />
      </mesh>
    </group>
  );
}

export default function MiniCharacter(props: Props) {
  const fb = <FallbackFigure tint={props.tint} />;
  return (
    <ModelBoundary fallback={fb}>
      <Suspense fallback={fb}>
        <Loaded {...props} />
      </Suspense>
      {props.children}
    </ModelBoundary>
  );
}
