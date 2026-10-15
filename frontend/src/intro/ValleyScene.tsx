// Intro final part: waking up on the red lateritic plateau; TERRA descends and boots up.
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import WorldScene from "../game/WorldScene";
import MiniCharacter, { type ClipPlay } from "../game/MiniCharacter";
import TerraRobot from "../game/TerraRobot";
import { heightAt } from "../game/terrain";
import { SPAWN } from "../game/worldConfig";

export type WakeStage = "lying" | "boot" | "standing";

export default function ValleyScene({ stage, reduceMotion }: { stage: WakeStage; reduceMotion: boolean }) {
  const { camera } = useThree();
  const [x, z] = SPAWN;
  const y = heightAt(x, z);
  const follow = useRef({ x, z, y: 0 }).current;
  const robot = useRef<THREE.Group>(null);
  const power = useRef(0);
  const look = useRef(new THREE.Vector3(x, y, z));
  const started = useRef(false);
  const [clip, setClip] = useState<ClipPlay>({ name: "die", mode: "once" });

  useEffect(() => {
    if (stage === "standing") {
      setClip({ name: "die", mode: "once", reverse: true, timeScale: 0.5 });
      const t = window.setTimeout(() => setClip({ name: "idle" }), 1400);
      return () => window.clearTimeout(t);
    }
  }, [stage]);

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    if (!started.current) {
      camera.position.set(x + 0.5, y + 16, z + 3);
      started.current = true;
    }
    const lying = stage === "lying";
    const camPos = lying ? new THREE.Vector3(x + 1.2, y + 7.5, z + 4.5) : new THREE.Vector3(x + 3.2, y + 2.8, z + 5.2);
    const camTgt = new THREE.Vector3(x, y + (lying ? 0.2 : 1.1), z - (lying ? 0 : 0.6));
    const k = 1 - Math.exp(-dt * (lying ? 0.6 : 1.4));
    camera.position.lerp(camPos, k);
    look.current.lerp(camTgt, k);
    camera.lookAt(look.current);
    // TERRA descends from the sky and powers on
    if (robot.current) {
      const target = new THREE.Vector3(x - 1.2, y + 2 + (reduceMotion ? 0 : Math.sin(t * 2) * 0.1), z + 0.6);
      if (stage === "lying") target.set(x - 1.2, y + 14, z - 2);
      robot.current.position.lerp(target, 1 - Math.exp(-dt * 1.3));
      robot.current.lookAt(camera.position.x, robot.current.position.y, camera.position.z);
    }
    power.current = stage === "lying" ? 0 : Math.min(1, power.current + dt * 0.45);
  });

  return (
    <>
      <WorldScene follow={follow} reduceMotion={reduceMotion} />
      <group position={[x, y, z]} rotation={[0, -0.6, 0]} scale={2}>
        <MiniCharacter model="player" clip={clip} />
      </group>
      <group ref={robot} position={[x - 1.2, y + 14, z - 2]} scale={0.95}>
        <TerraRobot power={power} reduceMotion={reduceMotion} />
      </group>
    </>
  );
}
