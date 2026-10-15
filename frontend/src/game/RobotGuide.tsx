// TERRA follows the player, bobs, faces the next destination and marks it with a beacon + ground chevrons.
// Its words come from `guidance()` (API text or generic navigation) — never authored advice.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import TerraRobot from "./TerraRobot";
import { Beacon } from "./Effects";
import { playerState } from "./gameStore";
import { heightAt } from "./terrain";
import { stationById, type StationId } from "./worldConfig";

const shorten = (s: string, n = 96) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export default function RobotGuide({ target, line, reduceMotion, showBubble }: { target: StationId | null; line: string; reduceMotion: boolean; showBubble: boolean }) {
  const bot = useRef<THREE.Group>(null);
  const holder = useRef<THREE.Group>(null);
  const chevrons = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(playerState.x - 1.5, 2.4, playerState.z + 1));
  const tgt = target ? stationById(target).pos : null;

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const p = playerState;
    // hover beside-behind the player (screen-left), slightly toward the destination
    let ox = -1.4;
    let oz = 0.6;
    if (tgt) {
      const dx = tgt[0] - p.x;
      const dz = tgt[1] - p.z;
      const d = Math.hypot(dx, dz) || 1;
      ox += (dx / d) * 0.6;
      oz += (dz / d) * 0.6;
    }
    const bob = reduceMotion ? 0 : Math.sin(t * 2) * 0.12;
    const desired = new THREE.Vector3(p.x + ox, p.y + 2.3 + bob, p.z + oz);
    pos.current.lerp(desired, 1 - Math.exp(-dt * 3));
    if (holder.current) holder.current.position.copy(pos.current);
    if (bot.current) {
      const lookX = tgt && Math.hypot(tgt[0] - p.x, tgt[1] - p.z) > 6 ? tgt[0] : p.x;
      const lookZ = tgt && Math.hypot(tgt[0] - p.x, tgt[1] - p.z) > 6 ? tgt[1] : p.z + 3;
      const yaw = Math.atan2(lookX - pos.current.x, lookZ - pos.current.z);
      bot.current.rotation.y += (((yaw - bot.current.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4);
      bot.current.rotation.z = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.06;
    }
    // ground chevrons from the player toward the target
    if (chevrons.current) {
      if (tgt) {
        const dx = tgt[0] - p.x;
        const dz = tgt[1] - p.z;
        const d = Math.hypot(dx, dz);
        chevrons.current.visible = d > 7;
        const yaw = Math.atan2(dx, dz);
        chevrons.current.children.forEach((c, i) => {
          const k = 1.6 + i * 0.9 + (reduceMotion ? 0 : (t * 1.2) % 0.9);
          const cx = p.x + (dx / d) * k;
          const cz = p.z + (dz / d) * k;
          c.position.set(cx, heightAt(cx, cz) + 0.08, cz);
          c.rotation.set(-Math.PI / 2, 0, yaw);
          const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
          m.opacity = 0.65 - i * 0.18;
        });
      } else chevrons.current.visible = false;
    }
  });

  return (
    <>
      <group ref={holder}>
        <group ref={bot} scale={0.95}>
          <TerraRobot reduceMotion={reduceMotion} />
        </group>
        {showBubble && line && (
          <Html position={[0, 0.85, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div className="w-max max-w-[240px] -translate-y-3 rounded-xl border border-cyan-300/40 bg-[#070b1a]/85 px-3 py-1.5 text-[11px] leading-snug text-cyan-50 shadow-[0_0_18px_rgba(56,225,255,0.25)] backdrop-blur">
              <span className="mr-1 font-display text-[9px] tracking-[0.2em] text-cyan-300">TERRA</span>
              {shorten(line)}
            </div>
          </Html>
        )}
      </group>
      <group ref={chevrons}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <shapeGeometry args={[chevronShape]} />
            <meshBasicMaterial color="#38e1ff" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {tgt && (
        <group position={[tgt[0], heightAt(tgt[0], tgt[1]), tgt[1]]}>
          <Beacon reduceMotion={reduceMotion} color={stationById(target!).color} />
        </group>
      )}
    </>
  );
}

const chevronShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.32, 0.12);
  s.lineTo(0, -0.2);
  s.lineTo(0.32, 0.12);
  s.lineTo(0.32, 0.26);
  s.lineTo(0, -0.06);
  s.lineTo(-0.32, 0.26);
  s.closePath();
  return s;
})();
