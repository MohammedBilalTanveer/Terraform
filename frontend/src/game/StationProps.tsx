// Hand-placed props for each location + state-driven world changes (stone lines, compost heap, water, plot).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InstancedModel, KModel, type InstanceItem } from "./assets";
import { heightAt } from "./terrain";
import { STATIONS, TERRACE_LINES, stationById, mulberry32 } from "./worldConfig";
import type { Collider } from "./collision";
import { LabelSprite, ScanRings } from "./Effects";
import FarmPlot from "./FarmPlot";
import { useTerraform } from "../store/terraformStore";
import { farmFor, useGame } from "./gameStore";
import { worldView } from "./planData";

type V3 = [number, number, number];
const G = (x: number, z: number, dy = 0): V3 => [x, heightAt(x, z) + dy, z];
const S = (id: Parameters<typeof stationById>[0]) => stationById(id).pos;

const camp = S("camp");
const board = S("board");
const soil = S("soil");
const compost = S("compost");
const water = S("water");
const harvest = S("harvest");
const terr = S("terraces");
const gully = S("gully");
const outpost = S("outpost");
const grove = S("grove");
const hole = S("waterhole");

/** Colliders for the hand-placed props (registered by the Explorer). */
export const STATION_COLLIDERS: Collider[] = [
  { x: camp[0] - 3, z: camp[1] + 2.5, r: 1.5 }, // tent
  { x: camp[0] + 1, z: camp[1] + 0.5, r: 0.7 }, // fire
  { x: camp[0] + 3.4, z: camp[1] + 2.2, r: 0.5 }, // crates
  { x: board[0], z: board[1] - 0.2, r: 0.9 },
  { x: board[0] - 0.9, z: board[1] - 0.2, r: 0.3 },
  { x: board[0] + 0.9, z: board[1] - 0.2, r: 0.3 },
  { x: compost[0] + 0.5, z: compost[1] - 1.2, r: 1.1 },
  { x: compost[0] - 1.8, z: compost[1] - 1.4, r: 0.6 },
  { x: water[0] - 1.6, z: water[1] - 1.4, r: 0.9 },
  { x: water[0] + 0.6, z: water[1] - 1.8, r: 0.9 },
  { x: water[0] - 2.4, z: water[1] + 0.6, r: 0.5 },
  { x: harvest[0], z: harvest[1] - 1.4, r: 0.8 },
  { x: harvest[0] + 1.8, z: harvest[1] - 0.8, r: 0.5 },
  { x: outpost[0] + 4, z: outpost[1] - 5, r: 2.7 },
  { x: outpost[0] - 3.5, z: outpost[1] - 5, r: 2.4 },
  { x: outpost[0] + 7, z: outpost[1] + 2, r: 2.4 },
  { x: outpost[0] + 8.5, z: outpost[1] - 3.5, r: 1.6 },
  { x: outpost[0] - 6, z: outpost[1] + 1, r: 0.4 },
  { x: outpost[0] + 3, z: outpost[1] + 6, r: 1.5 },
  { x: outpost[0], z: outpost[1] - 0.6, r: 0.6 },
  { x: grove[0], z: grove[1], r: 1.6 },
  { x: gully[0] + 3, z: gully[1] + 1, r: 1.2 },
];

function Board({ active }: { active: boolean }) {
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (glow.current) glow.current.opacity = 0.55 + Math.sin(clock.elapsedTime * 2) * 0.12;
  });
  const [x, y, z] = G(board[0], board[1]);
  return (
    <group position={[x, y, z - 0.2]}>
      {[-0.9, 0.9].map((dx) => (
        <mesh key={dx} position={[dx, 0.85, 0]} castShadow>
          <boxGeometry args={[0.12, 1.7, 0.12]} />
          <meshStandardMaterial color="#5a3b26" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[2, 1.1, 0.08]} />
        <meshStandardMaterial color="#1b2340" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.25, 0.05]}>
        <planeGeometry args={[1.8, 0.92]} />
        <meshBasicMaterial ref={glow} color={active ? "#38e1ff" : "#7bd389"} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {/* holo lines */}
      {[0.2, 0, -0.2].map((dy, i) => (
        <mesh key={i} position={[-0.15, 1.3 + dy, 0.06]}>
          <planeGeometry args={[1.2 - i * 0.25, 0.05]} />
          <meshBasicMaterial color="#070b1a" transparent opacity={0.55} />
        </mesh>
      ))}
      <KModel model="box" position={[1.4, 0, 0.4]} scale={2.6} rotation={0.4} />
    </group>
  );
}

function SoilPatch({ inspected }: { inspected: boolean }) {
  const [x, y, z] = G(soil[0], soil[1]);
  const holes: [number, number][] = [
    [-1.4, 0.6],
    [0.2, -0.8],
    [1.5, 0.7],
    [-0.2, 1.4],
  ];
  return (
    <group position={[x, y, z]}>
      {holes.map(([dx, dz], i) => (
        <group key={i} position={[dx, 0.02, dz]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.32, 10]} />
            <meshLambertMaterial color="#4a1f12" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[0.32, 0.5, 10]} />
            <meshLambertMaterial color="#a8603d" flatShading />
          </mesh>
          {/* probe stick */}
          {i % 2 === 0 && (
            <mesh position={[0.4, 0.3, 0]} rotation={[0, 0, 0.25]}>
              <cylinderGeometry args={[0.025, 0.025, 0.7, 5]} />
              <meshStandardMaterial color="#d8c7a0" />
            </mesh>
          )}
        </group>
      ))}
      <KModel model="bucket" position={[1.9, 0, -0.9]} scale={2.6} />
      <KModel model="pickaxe" position={[-2, 0.05, -0.7]} scale={3} rotation={[Math.PI / 2, 0.6, 0]} />
      <KModel model="signpost" position={[-2.2, 0, 1.6]} scale={2.6} rotation={0.3} />
      {inspected && <ScanRings radius={3} />}
    </group>
  );
}

function stonesAlong(seed: number, cx: number, cz: number, half: number, curve: number): InstanceItem[] {
  const rnd = mulberry32(seed);
  const out: InstanceItem[] = [];
  for (let t = -half; t <= half; t += 0.42) {
    const x = cx + t;
    const z = cz + Math.sin((t / half) * Math.PI) * curve + (rnd() - 0.5) * 0.12;
    out.push({ x, y: heightAt(x, z) - 0.04, z, rot: rnd() * 6.28, scale: 2.1 + rnd() * 0.8 });
  }
  return out;
}

function Terraces({ done, planned, hasPlan }: { done: number; planned: number; hasPlan: boolean }) {
  const lines = useMemo(
    () => TERRACE_LINES.map((l, i) => stonesAlong(900 + i, terr[0], terr[1] + l.z, l.half, i % 2 ? 0.35 : -0.3)),
    [],
  );
  // an old, half-collapsed demonstration line is always visible
  const demo = useMemo(() => stonesAlong(77, terr[0] + 2, terr[1] + 6.2, 3.2, 0.2).filter((_, i) => i % 3 !== 1), []);
  const shown = Math.min(done, lines.length);
  const ghosts = hasPlan ? Math.min(lines.length, Math.max(planned, 1)) : 0;
  const builtItems = useMemo(() => lines.slice(0, shown).flat(), [lines, shown]);
  return (
    <group>
      <InstancedModel model="stoneSmallA" items={demo} tint="#b0745a" tintAmount={0.25} />
      <InstancedModel key={`built-${shown}`} model="rockSmallB" items={builtItems} castShadow tint="#b78a6a" tintAmount={0.3} />
      {lines.slice(shown, ghosts).map((line, li) => (
        <group key={li}>
          {line
            .filter((_, i) => i % 3 === 0)
            .map((s, i) => (
              <mesh key={i} position={[s.x, s.y + 0.25, s.z]}>
                <boxGeometry args={[0.08, 0.5, 0.08]} />
                <meshBasicMaterial color="#38e1ff" transparent opacity={0.45} toneMapped={false} />
              </mesh>
            ))}
        </group>
      ))}
      <KModel model="signpost" position={G(terr[0] + 8.5, terr[1] + 4)} scale={3} rotation={-0.4} />
      <KModel model="shovel" position={G(terr[0] + 8, terr[1] + 2.5, 0.3)} scale={3} rotation={[0.3, 0, 0.2]} />
      <KModel model="resourceStone" position={G(terr[0] + 7, terr[1] + 2.8)} scale={3} />
      <KModel model="resourceStone" position={G(terr[0] + 7.6, terr[1] + 3.4)} scale={2.6} rotation={1} />
    </group>
  );
}

function CompostStation({ done }: { done: number }) {
  const [x, y, z] = G(compost[0], compost[1]);
  const h = 0.5 + Math.min(done, 4) * 0.28;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0.5, h / 2, -1.2]} castShadow receiveShadow>
        <coneGeometry args={[1.1, h, 8]} />
        <meshLambertMaterial color={done > 0 ? "#4a2e1c" : "#6b4a33"} flatShading />
      </mesh>
      {/* leaf litter + mulch piles */}
      <mesh position={[-1.8, 0.25, -1.4]} castShadow>
        <coneGeometry args={[0.7, 0.5, 7]} />
        <meshLambertMaterial color="#9a7a3a" flatShading />
      </mesh>
      <mesh position={[-1.1, 0.18, 0.4]}>
        <coneGeometry args={[0.5, 0.36, 7]} />
        <meshLambertMaterial color="#c9a85a" flatShading />
      </mesh>
      {/* bin frame */}
      <KModel model="fence" position={[0.5, 0, -2.4]} scale={3} />
      <KModel model="fence" position={[-0.9, 0, -1.2]} scale={3} rotation={Math.PI / 2} />
      <KModel model="bucket" position={[1.6, 0, 0.2]} scale={2.6} />
      <KModel model="shovel" position={[1.9, 0.4, -0.6]} scale={3} rotation={[0.2, 0, -0.25]} />
      <KModel model="boxLarge" position={[-2.4, 0, 0.4]} scale={2.6} rotation={0.3} />
      {done > 0 && <ScanRings radius={1.8} color="#7bd389" count={2} speed={0.4} />}
    </group>
  );
}

function WaterStorage({ done }: { done: number }) {
  const [x, y, z] = G(water[0], water[1]);
  const barrels: [number, number, boolean][] = [
    [-1.6, -1.4, true],
    [-0.9, -1.9, false],
    [0.2, -2.0, true],
    [1.0, -1.6, false],
  ];
  return (
    <group position={[x, y, z]}>
      {barrels.map(([dx, dz, open], i) => (
        <group key={i} position={[dx, 0, dz]}>
          <KModel model={open ? "barrelOpen" : "barrel"} scale={2.8} rotation={i} />
          {open && i < done * 2 + 0 && (
            <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.28, 14]} />
              <meshStandardMaterial color="#5ab8e8" roughness={0.1} emissive="#1c5a7a" emissiveIntensity={0.4} />
            </mesh>
          )}
        </group>
      ))}
      <KModel model="structureCanvas" position={[0.6, 0, -1.8]} scale={3.6} rotation={0} />
      <KModel model="bucket" position={[-2.4, 0, 0.6]} scale={2.6} />
      <KModel model="bucket" position={[-2.0, 0, 1.0]} scale={2.4} rotation={1} />
      {/* small catch basin */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.9, 0.02, 0.9]}>
        <circleGeometry args={[0.8, 12]} />
        <meshLambertMaterial color={done > 0 ? "#3d6f7c" : "#5a2a1a"} />
      </mesh>
      {done > 0 && <ScanRings radius={1.6} color="#5ab8e8" count={2} speed={0.4} />}
    </group>
  );
}

function HarvestPoint({ ready, harvested }: { ready: boolean; harvested: boolean }) {
  const [x, y, z] = G(harvest[0], harvest[1]);
  return (
    <group position={[x, y, z]}>
      <KModel model="workbench" position={[0, 0, -1.4]} scale={3.4} />
      <KModel model="box" position={[1.8, 0, -0.8]} scale={2.8} rotation={0.3} />
      <KModel model="box" position={[1.8, 0.7, -0.8]} scale={2.6} rotation={-0.2} />
      <KModel model="potLarge" position={[-1.6, 0, -0.6]} scale={2.4} />
      <KModel model="potLarge" position={[-1.9, 0, 0.6]} scale={2.1} />
      {/* drying mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0.2]} position={[0.2, 0.03, 1]} receiveShadow>
        <planeGeometry args={[2.2, 1.4]} />
        <meshLambertMaterial color="#d8b878" />
      </mesh>
      {harvested &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[-0.6 + (i % 3) * 0.5, 0.1, 0.7 + Math.floor(i / 3) * 0.5]} castShadow>
            <dodecahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial color="#e3b448" flatShading />
          </mesh>
        ))}
      {ready && <ScanRings radius={2.2} color="#f6c177" count={3} speed={0.5} />}
    </group>
  );
}

function Outpost() {
  const blink = useRef<THREE.MeshBasicMaterial>(null);
  const screen = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (blink.current) blink.current.color.set(Math.sin(t * 3) > 0.3 ? "#ff5a5a" : "#4a1010");
    if (screen.current) screen.current.opacity = 0.75 + Math.sin(t * 4) * 0.08;
  });
  const [ox, oy, oz] = G(outpost[0], outpost[1]);
  return (
    <group>
      <KModel model="houseD" position={G(outpost[0] + 4, outpost[1] - 5.2)} scale={3.6} />
      <KModel model="houseB" position={G(outpost[0] - 3.5, outpost[1] - 5.2)} scale={3.3} />
      <KModel model="houseG" position={G(outpost[0] + 7.2, outpost[1] + 2)} scale={3.4} rotation={-Math.PI / 2} />
      <KModel model="scaffold" position={G(outpost[0] + 8.5, outpost[1] - 3.5)} scale={3} />
      <KModel model="truck" position={G(outpost[0] + 3, outpost[1] + 6)} scale={1.6} rotation={Math.PI / 2} />
      <KModel model="pallet" position={G(outpost[0] - 3, outpost[1] + 4)} scale={2.4} rotation={0.4} />
      <KModel model="boxLarge" position={G(outpost[0] - 3, outpost[1] + 4, 0.35)} scale={2.4} rotation={0.4} />
      <KModel model="barrier" position={G(outpost[0] - 5, outpost[1] + 6.5)} scale={2.6} rotation={0.6} />
      {/* antenna mast */}
      <group position={G(outpost[0] - 6, outpost[1] + 1)}>
        <mesh position={[0, 3, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.12, 6, 6]} />
          <meshStandardMaterial color="#9aa4ad" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 6.1, 0]}>
          <sphereGeometry args={[0.14, 10, 8]} />
          <meshBasicMaterial ref={blink} color="#ff5a5a" toneMapped={false} />
        </mesh>
        <mesh position={[0.45, 4.6, 0]} rotation={[0, 0, -0.6]}>
          <coneGeometry args={[0.5, 0.25, 12, 1, true]} />
          <meshStandardMaterial color="#d9dee3" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* solar panels */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={G(outpost[0] - 4.5 + i * 1.5, outpost[1] - 1.5)}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[0.08, 0.7, 0.08]} />
            <meshStandardMaterial color="#6d747a" />
          </mesh>
          <mesh position={[0, 0.75, 0]} rotation={[-0.7, 0, 0]} castShadow>
            <boxGeometry args={[1.2, 0.05, 0.8]} />
            <meshStandardMaterial color="#1d3a6b" metalness={0.6} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* field terminal */}
      <group position={[ox, oy, oz - 0.6]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.9, 1.1, 0.5]} />
          <meshStandardMaterial color="#2a3352" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.25, 0.1]} rotation={[-0.35, 0, 0]}>
          <planeGeometry args={[0.8, 0.5]} />
          <meshBasicMaterial ref={screen} color="#8b5cf6" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      </group>
      <DemoGarden />
    </group>
  );
}

/** Demonstration features (raised bed, planting pit, contour stone line) — purely visual. */
function DemoGarden() {
  const cx = outpost[0] - 7;
  const cz = outpost[1] + 7.5;
  const line = useMemo(() => stonesAlong(31, cx + 0.5, cz + 2.2, 2.2, 0.25), [cx, cz]);
  return (
    <group>
      <group position={G(cx - 1.4, cz)}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.4, 1]} />
          <meshLambertMaterial color="#7a4a2c" flatShading />
        </mesh>
        <mesh position={[0, 0.41, 0]}>
          <boxGeometry args={[2, 0.04, 0.82]} />
          <meshLambertMaterial color="#3e2416" />
        </mesh>
      </group>
      <group position={G(cx + 1.6, cz)}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[0.45, 12]} />
          <meshLambertMaterial color="#3a1a0e" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.45, 0.65, 12]} />
          <meshLambertMaterial color="#a8603d" />
        </mesh>
      </group>
      <InstancedModel model="stoneSmallB" items={line} tint="#b0745a" tintAmount={0.25} />
      <LabelSprite text="Demonstration garden" position={G(cx, cz - 1.2, 1.8)} height={0.42} color="#f6c177" />
    </group>
  );
}

function Camp() {
  const fire = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
    if (fire.current) fire.current.intensity = 6 * f;
    if (flame.current) flame.current.scale.set(1, f, 1);
  });
  const fp = G(camp[0] + 1, camp[1] + 0.5);
  return (
    <group>
      <KModel model="tentNature" position={G(camp[0] - 3, camp[1] + 2.5)} scale={3.3} rotation={0.5} />
      <KModel model="campfireStones" position={fp} scale={3} />
      <mesh ref={flame} position={[fp[0], fp[1] + 0.35, fp[2]]}>
        <coneGeometry args={[0.22, 0.6, 7]} />
        <meshBasicMaterial color="#ffb24a" toneMapped={false} />
      </mesh>
      <pointLight ref={fire} position={[fp[0], fp[1] + 0.9, fp[2]]} color="#ff9a4a" intensity={6} distance={8} decay={2} />
      <KModel model="log" position={G(camp[0] + 2.6, camp[1] + 0.2)} scale={3} rotation={0.2} />
      <KModel model="log" position={G(camp[0] - 0.4, camp[1] - 1.1)} scale={3} rotation={1.6} />
      <KModel model="box" position={G(camp[0] + 3.4, camp[1] + 2.2)} scale={2.6} rotation={0.2} />
      <KModel model="chest" position={G(camp[0] + 3.0, camp[1] + 3.1)} scale={2.6} rotation={-0.3} />
      <KModel model="logStack" position={G(camp[0] - 4.6, camp[1] + 0.2)} scale={3} rotation={0.4} />
    </group>
  );
}

function Gully() {
  const rocks = useMemo(() => {
    const rnd = mulberry32(42);
    return Array.from({ length: 10 }).map(() => {
      const x = gully[0] + (rnd() - 0.5) * 8;
      const z = gully[1] + (rnd() - 0.5) * 8;
      return { x, y: heightAt(x, z) - 0.05, z, rot: rnd() * 6, scale: 1.4 + rnd() };
    });
  }, []);
  return (
    <group>
      <InstancedModel model="rockLargeC" items={rocks} castShadow tint="#9c4a2c" tintAmount={0.35} />
      <KModel model="signpost" position={G(gully[0] + 3, gully[1] + 1)} scale={3} rotation={-0.5} />
    </group>
  );
}

function Lookout() {
  return (
    <group>
      <KModel model="rockLargeD" position={G(grove[0], grove[1], -0.1)} scale={3.4} tint="#b0613f" tintAmount={0.25} />
      <KModel model="signpost" position={G(grove[0] + 2.4, grove[1] + 1.5)} scale={3} rotation={0.4} />
      <KModel model="stump" position={G(grove[0] - 2, grove[1] + 2)} scale={3} />
    </group>
  );
}

function Waterhole() {
  const reeds = useMemo(() => {
    const rnd = mulberry32(7);
    return Array.from({ length: 26 }).map(() => {
      const a = rnd() * Math.PI * 2;
      const r = 4.6 + rnd() * 1.8;
      const x = hole[0] + Math.cos(a) * r;
      const z = hole[1] + Math.sin(a) * r;
      return { x, y: heightAt(x, z), z, rot: rnd() * 6, scale: 2 + rnd() * 1.2 };
    });
  }, []);
  return <InstancedModel model="grassLarge" items={reeds} tint="#6f8f3c" tintAmount={0.4} />;
}

export default function StationProps({ reduceMotion }: { reduceMotion: boolean }) {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const crop = useTerraform((s) => s.selectedCropId);
  const sessionId = useTerraform((s) => s.sessionId);
  const farmRaw = useGame((s) => s.farm);
  const area = useGame((s) => s.area);
  const farm = farmFor(farmRaw, sessionId);
  const view = useMemo(() => worldView(analysis, plan, completed, crop, farm), [analysis, plan, completed, crop, farm]);

  return (
    <group>
      <Camp />
      <Board active={!analysis} />
      <SoilPatch inspected={!!analysis && !plan} />
      <FarmPlot view={view} reduceMotion={reduceMotion} />
      <CompostStation done={view.compostDone} />
      <WaterStorage done={view.waterDone} />
      <HarvestPoint ready={view.stage === "harvest_ready"} harvested={farm.harvested} />
      <Terraces done={view.stoneLines} planned={view.stoneLinesPlanned} hasPlan={!!plan} />
      <Outpost />
      <Gully />
      <Lookout />
      <Waterhole />
      {STATIONS.filter((s) => s.id !== area).map((s) => (
        <LabelSprite key={s.id} text={s.name} position={G(s.pos[0], s.pos[1], s.id === "outpost" ? 5.6 : s.id === "terraces" ? 4 : 3.6)} height={0.42} color={s.color} />
      ))}
    </group>
  );
}
