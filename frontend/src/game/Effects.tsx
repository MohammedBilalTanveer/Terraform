// Small reusable visual pieces: text sprites, scan rings, beacons, particle bursts, dust.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function makeLabelTexture(text: string, opts: { color?: string; bg?: string; font?: string; pad?: number } = {}) {
  const font = opts.font ?? "600 44px 'Space Grotesk', 'Inter', sans-serif";
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + (opts.pad ?? 36) * 2;
  const h = 76;
  c.width = Math.min(1024, w);
  c.height = h;
  const g = c.getContext("2d")!;
  g.font = font;
  g.textBaseline = "middle";
  g.textAlign = "center";
  if (opts.bg !== "none") {
    g.fillStyle = opts.bg ?? "rgba(7,11,26,0.72)";
    const r = 22;
    g.beginPath();
    g.moveTo(r, 4);
    g.arcTo(c.width - 4, 4, c.width - 4, h - 4, r);
    g.arcTo(c.width - 4, h - 4, 4, h - 4, r);
    g.arcTo(4, h - 4, 4, 4, r);
    g.arcTo(4, 4, c.width - 4, 4, r);
    g.fill();
    g.strokeStyle = (opts.color ?? "#38e1ff") + "99";
    g.lineWidth = 3;
    g.stroke();
  }
  g.fillStyle = opts.color ?? "#f4efe6";
  g.fillText(text, c.width / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return { tex, aspect: c.width / c.height };
}

export function LabelSprite({ text, position, height = 0.55, color, bg, depthTest = true }: { text: string; position: [number, number, number]; height?: number; color?: string; bg?: string; depthTest?: boolean }) {
  const { tex, aspect } = useMemo(() => makeLabelTexture(text, { color, bg }), [text, color, bg]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={5}>
      <spriteMaterial map={tex} transparent depthTest={depthTest} depthWrite={false} fog={false} />
    </sprite>
  );
}

/** Expanding cyan scan rings on the ground. */
export function ScanRings({ radius = 3, color = "#38e1ff", speed = 0.6, count = 3, active = true }: { radius?: number; color?: string; speed?: number; count?: number; active?: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = active ? (t + i / count) % 1 : 0.6;
      m.scale.setScalar(0.15 + p * radius);
      (m.material as THREE.MeshBasicMaterial).opacity = active ? (1 - p) * 0.6 : 0.25;
    });
  });
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06 + i * 0.002, 0]}>
          <ringGeometry args={[0.92, 1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Tall light pillar marking TERRA's suggested destination. */
export function Beacon({ color = "#38e1ff", height = 14, reduceMotion = false }: { color?: string; height?: number; reduceMotion?: boolean }) {
  const pillar = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pillar.current) (pillar.current.material as THREE.MeshBasicMaterial).opacity = reduceMotion ? 0.22 : 0.16 + Math.sin(t * 2.2) * 0.06;
    if (ring.current) {
      const p = reduceMotion ? 0.5 : (t * 0.7) % 1;
      ring.current.scale.setScalar(0.6 + p * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.7;
    }
  });
  return (
    <group>
      <mesh ref={pillar} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.32, 0.55, height, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[0.85, 1, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Particle burst that runs while `active` is true (dust / seeds / droplets / sparkles). */
export function ParticleBurst({ active, kind, count = 40 }: { active: boolean; kind: "dust" | "seeds" | "drops" | "sparkle" | "compost"; count?: number }) {
  const pts = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count).map(() => Math.random());
    return { pos, vel, life };
  }, [count]);
  const style = {
    dust: { color: "#d08a5c", size: 0.16, g: -0.4, spread: 1.2, up: 0.9 },
    seeds: { color: "#f4dfa0", size: 0.08, g: -6, spread: 0.6, up: 0.6 },
    drops: { color: "#7fd6ff", size: 0.09, g: -9, spread: 0.35, up: 0.2 },
    sparkle: { color: "#ffe28a", size: 0.14, g: 0.6, spread: 0.9, up: 1.5 },
    compost: { color: "#5a3a22", size: 0.11, g: -5, spread: 0.5, up: 0.4 },
  }[kind];
  useFrame((_, dtRaw) => {
    const p = pts.current;
    if (!p) return;
    p.visible = active;
    if (!active) return;
    const dt = Math.min(dtRaw, 0.05);
    const { pos, vel, life } = data;
    for (let i = 0; i < count; i++) {
      life[i] += dt * (0.8 + (i % 5) * 0.12);
      if (life[i] >= 1) {
        life[i] = 0;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.25;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = kind === "drops" || kind === "compost" ? 0.75 : kind === "seeds" ? 0.5 : 0.05;
        pos[i * 3 + 2] = Math.sin(a) * r + (kind === "drops" || kind === "compost" ? 0.55 : 0.4);
        vel[i * 3] = Math.cos(a) * style.spread * Math.random();
        vel[i * 3 + 1] = style.up * (0.5 + Math.random());
        vel[i * 3 + 2] = Math.sin(a) * style.spread * Math.random();
      }
      vel[i * 3 + 1] += style.g * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] = Math.max(0.02, pos[i * 3 + 1] + vel[i * 3 + 1] * dt);
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }
    (p.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={pts} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={style.color} size={style.size} sizeAttenuation transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </points>
  );
}

/** Floating golden-hour dust motes that follow a target (cheap: one Points object). */
export function DustMotes({ follow, count = 180, reduceMotion = false }: { follow: { x: number; z: number; y?: number }; count?: number; reduceMotion?: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const base = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 40;
      a[i * 3 + 1] = Math.random() * 6 + 0.3;
      a[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return a;
  }, [count]);
  const pos = useMemo(() => base.slice(), [base]);
  useFrame(({ clock }) => {
    const p = ref.current;
    if (!p) return;
    p.position.set(follow.x, follow.y ?? 0, follow.z);
    if (reduceMotion) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.2 + i) * 0.8 + ((t * 0.35 + i * 0.37) % 6) - 3;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.5 + i * 1.7) * 0.3;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.17 + i) * 0.8;
    }
    (p.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffd9a0" size={0.07} sizeAttenuation transparent opacity={0.55} depthWrite={false} toneMapped={false} />
    </points>
  );
}
