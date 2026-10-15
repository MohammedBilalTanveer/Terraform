// TERRA — the flying field robot, built from primitives (rounded body, cyan eye, antenna, hover thrusters).
import { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  /** 0 = powered down, 1 = fully booted (eye + thrusters glow) */
  power?: { current: number };
  reduceMotion?: boolean;
  light?: boolean;
};

const TerraRobot = forwardRef<THREE.Group, Props>(function TerraRobot({ power, reduceMotion = false, light = true }, ref) {
  const eye = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const tip = useRef<THREE.MeshBasicMaterial>(null);
  const pl = useRef<THREE.PointLight>(null);
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eef2f6", roughness: 0.35, metalness: 0.15 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a2238", roughness: 0.3, metalness: 0.4 }), []);
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e07a5f", roughness: 0.5 }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pw = power ? power.current : 1;
    const flick = pw < 1 && pw > 0 ? (Math.sin(t * 40) > 0 ? 1 : 0.3) : 1;
    const glow = pw * flick;
    const c = new THREE.Color("#38e1ff").multiplyScalar(0.15 + glow * 0.85);
    eye.current?.color.copy(c);
    ringMat.current?.color.copy(c);
    if (tip.current) tip.current.color.set(Math.sin(t * 4) > 0 && pw > 0.5 ? "#7bd389" : "#203028");
    flames.current.forEach((f, i) => {
      if (!f) return;
      const s = pw * (0.8 + (reduceMotion ? 0 : Math.sin(t * 30 + i) * 0.2));
      f.scale.set(1, Math.max(0.01, s), 1);
    });
    if (pl.current) pl.current.intensity = glow * 2.2;
  });

  return (
    <group ref={ref}>
      {/* body */}
      <mesh material={shell} castShadow>
        <sphereGeometry args={[0.42, 24, 18]} />
      </mesh>
      <mesh material={accent} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.425, 0.035, 8, 32]} />
      </mesh>
      {/* visor */}
      <mesh material={dark} position={[0, 0.06, 0.2]} scale={[1, 0.62, 0.7]}>
        <sphereGeometry args={[0.3, 20, 14]} />
      </mesh>
      <mesh position={[0, 0.07, 0.42]}>
        <circleGeometry args={[0.09, 20]} />
        <meshBasicMaterial ref={eye} color="#38e1ff" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.07, 0.415]}>
        <ringGeometry args={[0.11, 0.13, 24]} />
        <meshBasicMaterial ref={ringMat} color="#38e1ff" toneMapped={false} transparent opacity={0.8} />
      </mesh>
      {/* antenna */}
      <mesh material={dark} position={[0.1, 0.5, -0.05]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.25, 5]} />
      </mesh>
      <mesh position={[0.13, 0.64, -0.05]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial ref={tip} color="#7bd389" toneMapped={false} />
      </mesh>
      {/* thruster pods */}
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 0.47, -0.12, 0]}>
          <mesh material={shell} rotation={[0, 0, side * 0.25]}>
            <capsuleGeometry args={[0.08, 0.16, 4, 10]} />
          </mesh>
          <mesh
            ref={(el) => void (flames.current[i] = el)}
            position={[0, -0.24, 0]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.06, 0.22, 10]} />
            <meshBasicMaterial color="#7fe9ff" transparent opacity={0.85} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {light && <pointLight ref={pl} position={[0, 0, 0.6]} color="#38e1ff" intensity={2} distance={5} decay={2} />}
    </group>
  );
});

export default TerraRobot;
