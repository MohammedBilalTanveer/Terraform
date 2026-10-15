// Kenney CC0 model loader with per-model graceful fallback (ErrorBoundary + Suspense → primitive).
import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const BASE = "/assets/kenney";
export const MODELS = {
  // characters
  player: `${BASE}/characters/character-male-a.glb`,
  stranger: `${BASE}/characters/character-male-e.glb`,
  walkerA: `${BASE}/characters/character-female-b.glb`,
  walkerB: `${BASE}/characters/character-female-c.glb`,
  walkerC: `${BASE}/characters/character-male-c.glb`,
  // nature
  treePlateau: `${BASE}/nature/tree_plateau.glb`,
  treeFat: `${BASE}/nature/tree_fat.glb`,
  treeFall: `${BASE}/nature/tree_default_fall.glb`,
  treeOak: `${BASE}/nature/tree_oak.glb`,
  treeThin: `${BASE}/nature/tree_thin.glb`,
  treeSimple: `${BASE}/nature/tree_simple.glb`,
  treeBlocksFall: `${BASE}/nature/tree_blocks_fall.glb`,
  bush: `${BASE}/nature/plant_bush.glb`,
  bushSmall: `${BASE}/nature/plant_bushSmall.glb`,
  bushLarge: `${BASE}/nature/plant_bushLarge.glb`,
  bushDetailed: `${BASE}/nature/plant_bushDetailed.glb`,
  cactus: `${BASE}/nature/cactus_short.glb`,
  grass: `${BASE}/nature/grass.glb`,
  grassLarge: `${BASE}/nature/grass_large.glb`,
  grassLeafs: `${BASE}/nature/grass_leafs.glb`,
  rockLargeA: `${BASE}/nature/rock_largeA.glb`,
  rockLargeB: `${BASE}/nature/rock_largeB.glb`,
  rockLargeC: `${BASE}/nature/rock_largeC.glb`,
  rockLargeD: `${BASE}/nature/rock_largeD.glb`,
  rockTallA: `${BASE}/nature/rock_tallA.glb`,
  rockTallB: `${BASE}/nature/rock_tallB.glb`,
  rockTallC: `${BASE}/nature/rock_tallC.glb`,
  rockSmallA: `${BASE}/nature/rock_smallA.glb`,
  rockSmallB: `${BASE}/nature/rock_smallB.glb`,
  rockSmallC: `${BASE}/nature/rock_smallC.glb`,
  rockFlat: `${BASE}/nature/rock_smallFlatA.glb`,
  stoneSmallA: `${BASE}/nature/stone_smallA.glb`,
  stoneSmallB: `${BASE}/nature/stone_smallB.glb`,
  stoneLarge: `${BASE}/nature/stone_largeA.glb`,
  stump: `${BASE}/nature/stump_old.glb`,
  log: `${BASE}/nature/log.glb`,
  logStack: `${BASE}/nature/log_stack.glb`,
  tentNature: `${BASE}/nature/tent_detailedOpen.glb`,
  campfireStones: `${BASE}/nature/campfire_stones.glb`,
  sign: `${BASE}/nature/sign.glb`,
  dirtRow: `${BASE}/nature/crops_dirtRow.glb`,
  dirtSingle: `${BASE}/nature/crops_dirtSingle.glb`,
  cornA: `${BASE}/nature/crops_cornStageA.glb`,
  cornB: `${BASE}/nature/crops_cornStageB.glb`,
  cornC: `${BASE}/nature/crops_cornStageC.glb`,
  cornD: `${BASE}/nature/crops_cornStageD.glb`,
  wheatA: `${BASE}/nature/crops_wheatStageA.glb`,
  wheatB: `${BASE}/nature/crops_wheatStageB.glb`,
  leafsA: `${BASE}/nature/crops_leafsStageA.glb`,
  leafsB: `${BASE}/nature/crops_leafsStageB.glb`,
  cliffBlock: `${BASE}/nature/cliff_block_rock.glb`,
  cliffLarge: `${BASE}/nature/cliff_large_rock.glb`,
  potLarge: `${BASE}/nature/pot_large.glb`,
  fenceSimple: `${BASE}/nature/fence_simple.glb`,
  pathStone: `${BASE}/nature/path_stone.glb`,
  // survival
  barrel: `${BASE}/survival/barrel.glb`,
  barrelOpen: `${BASE}/survival/barrel-open.glb`,
  bucket: `${BASE}/survival/bucket.glb`,
  box: `${BASE}/survival/box.glb`,
  boxLarge: `${BASE}/survival/box-large.glb`,
  shovel: `${BASE}/survival/tool-shovel.glb`,
  hoe: `${BASE}/survival/tool-hoe.glb`,
  pickaxe: `${BASE}/survival/tool-pickaxe.glb`,
  tent: `${BASE}/survival/tent.glb`,
  campfirePit: `${BASE}/survival/campfire-pit.glb`,
  workbench: `${BASE}/survival/workbench.glb`,
  signpost: `${BASE}/survival/signpost.glb`,
  structure: `${BASE}/survival/structure.glb`,
  structureCanvas: `${BASE}/survival/structure-canvas.glb`,
  structureRoof: `${BASE}/survival/structure-roof.glb`,
  resourceStone: `${BASE}/survival/resource-stone.glb`,
  resourceWood: `${BASE}/survival/resource-wood.glb`,
  rockSandA: `${BASE}/survival/rock-sand-a.glb`,
  rockSandB: `${BASE}/survival/rock-sand-b.glb`,
  rockSandC: `${BASE}/survival/rock-sand-c.glb`,
  fence: `${BASE}/survival/fence.glb`,
  chest: `${BASE}/survival/chest.glb`,
  bottle: `${BASE}/survival/bottle-large.glb`,
  // urban / suburban (intro street + outpost)
  roadStraight: `${BASE}/urban/road-asphalt-straight.glb`,
  roadSide: `${BASE}/urban/road-asphalt-side.glb`,
  pavement: `${BASE}/urban/road-asphalt-pavement.glb`,
  streetLight: `${BASE}/urban/detail-light-single.glb`,
  bench: `${BASE}/urban/detail-bench.glb`,
  parkTree: `${BASE}/urban/tree-park-large.glb`,
  urbanTreeSmall: `${BASE}/urban/tree-small.glb`,
  truck: `${BASE}/urban/truck-green.glb`,
  dumpster: `${BASE}/urban/detail-dumpster-closed.glb`,
  barrier: `${BASE}/urban/detail-barrier-type-a.glb`,
  pallet: `${BASE}/urban/pallet.glb`,
  scaffold: `${BASE}/urban/scaffolding-structure.glb`,
  houseA: `${BASE}/suburban/building-type-a.glb`,
  houseB: `${BASE}/suburban/building-type-b.glb`,
  houseC: `${BASE}/suburban/building-type-c.glb`,
  houseD: `${BASE}/suburban/building-type-d.glb`,
  houseE: `${BASE}/suburban/building-type-e.glb`,
  houseF: `${BASE}/suburban/building-type-f.glb`,
  houseG: `${BASE}/suburban/building-type-g.glb`,
  houseH: `${BASE}/suburban/building-type-h.glb`,
  suburbanFence: `${BASE}/suburban/fence-1x3.glb`,
  planter: `${BASE}/suburban/planter.glb`,
  suburbanTree: `${BASE}/suburban/tree-large.glb`,
  suburbanTreeSmall: `${BASE}/suburban/tree-small.glb`,
} as const;

export type ModelKey = keyof typeof MODELS;
export type FallbackKind = "tree" | "rock" | "bush" | "grass" | "box" | "barrel" | "tent" | "house" | "crop" | "tool" | "none";

// ---------------------------------------------------------------------------------------------
// Primitive fallbacks (flat-shaded, tasteful) so the world works with zero downloaded assets.
const fbMat = (c: string) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });
const FB = {
  trunk: fbMat("#6b4a2f"),
  leaf: fbMat("#6f8a3a"),
  rock: fbMat("#8c5a43"),
  bush: fbMat("#7c7a3a"),
  grass: fbMat("#b8964f"),
  wood: fbMat("#9a6b3f"),
  metal: fbMat("#7d8a92"),
  canvas: fbMat("#d8c7a0"),
  wall: fbMat("#d9cdb8"),
  roof: fbMat("#9c4a35"),
  sprout: fbMat("#7bd389"),
};

export function PrimitiveFallback({ kind }: { kind: FallbackKind }) {
  switch (kind) {
    case "tree":
      return (
        <group>
          <mesh material={FB.trunk} position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 0.7, 6]} />
          </mesh>
          <mesh material={FB.leaf} position={[0, 0.95, 0]} castShadow>
            <icosahedronGeometry args={[0.38, 0]} />
          </mesh>
        </group>
      );
    case "rock":
      return (
        <mesh material={FB.rock} position={[0, 0.2, 0]} castShadow>
          <dodecahedronGeometry args={[0.35, 0]} />
        </mesh>
      );
    case "bush":
      return (
        <mesh material={FB.bush} position={[0, 0.12, 0]}>
          <icosahedronGeometry args={[0.18, 0]} />
        </mesh>
      );
    case "grass":
      return (
        <mesh material={FB.grass} position={[0, 0.08, 0]}>
          <coneGeometry args={[0.12, 0.2, 4]} />
        </mesh>
      );
    case "crop":
      return (
        <mesh material={FB.sprout} position={[0, 0.15, 0]}>
          <coneGeometry args={[0.1, 0.3, 5]} />
        </mesh>
      );
    case "box":
      return (
        <mesh material={FB.wood} position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
        </mesh>
      );
    case "barrel":
      return (
        <mesh material={FB.wood} position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.34, 10]} />
        </mesh>
      );
    case "tent":
      return (
        <mesh material={FB.canvas} position={[0, 0.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.4, 0.5, 4]} />
        </mesh>
      );
    case "house":
      return (
        <group>
          <mesh material={FB.wall} position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[1.1, 0.6, 0.9]} />
          </mesh>
          <mesh material={FB.roof} position={[0, 0.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.85, 0.35, 4]} />
          </mesh>
        </group>
      );
    case "tool":
      return (
        <mesh material={FB.metal} position={[0, 0.12, 0]}>
          <boxGeometry args={[0.03, 0.25, 0.03]} />
        </mesh>
      );
    default:
      return null;
  }
}

export function guessFallback(key: ModelKey): FallbackKind {
  const k = key.toLowerCase();
  if (k.includes("tree")) return "tree";
  if (k.includes("rock") || k.includes("stone") || k.includes("cliff")) return "rock";
  if (k.includes("bush") || k.includes("cactus")) return "bush";
  if (k.includes("grass")) return "grass";
  if (k.includes("corn") || k.includes("wheat") || k.includes("leafs")) return "crop";
  if (k.includes("barrel") || k.includes("bucket") || k.includes("pot")) return "barrel";
  if (k.includes("tent") || k.includes("structure")) return "tent";
  if (k.includes("house") || k.includes("scaffold")) return "house";
  if (k.includes("shovel") || k.includes("hoe") || k.includes("pickaxe")) return "tool";
  if (k.includes("box") || k.includes("chest") || k.includes("crate") || k.includes("workbench") || k.includes("pallet")) return "box";
  return "none";
}

// ---------------------------------------------------------------------------------------------
type BoundaryProps = { fallback: ReactNode; children: ReactNode };
export class ModelBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[TERRAFORM] model failed to load, using primitive fallback:", (err as Error)?.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Vec3 = [number, number, number];

/** Nature Kit ships lush greens; on the lateritic plateau we re-colour by material name (dry season). */
const NATURE_REMAP: Record<string, string> = {
  grass: "#b39a58",
  dirt: "#9c5638",
  leafsGreen: "#6f8740",
  leafsDark: "#56702f",
  leafsFall: "#b8823a",
  woodBark: "#6b4733",
  stone: "#b29a88",
};
const remapCache = new Map<string, THREE.Material>();
function remapMaterial(m: THREE.Material, url: string): THREE.Material {
  if (!url.includes("/nature/")) return m;
  const key = m.uuid;
  let r = remapCache.get(key);
  if (!r) {
    const c = (m as THREE.MeshStandardMaterial).clone();
    const target = NATURE_REMAP[m.name];
    if (target && c.color) c.color.set(target);
    // Nature Kit materials declare metallicFactor 1 — without an env map that renders near-black.
    c.metalness = 0;
    c.roughness = 0.92;
    c.flatShading = true;
    if (/grass|leaf/i.test(m.name)) c.side = THREE.DoubleSide;
    r = c;
    remapCache.set(key, r);
  }
  return r;
}

function tintMaterial(m: THREE.Material, tint: string | undefined, amount: number): THREE.Material {
  if (!tint) return m;
  const c = (m as THREE.MeshStandardMaterial).clone();
  if (c.color) c.color.lerp(new THREE.Color(tint), amount);
  return c;
}

const prepMaterial = (m: THREE.Material, url: string, tint: string | undefined, amount: number) => tintMaterial(remapMaterial(m, url), tint, amount);

function LoadedModel({ url, tint, tintAmount = 0.5, shadows = true }: { url: string; tint?: string; tintAmount?: number; shadows?: boolean }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = shadows;
        m.receiveShadow = true;
        m.material = Array.isArray(m.material) ? m.material.map((x) => prepMaterial(x, url, tint, tintAmount)) : prepMaterial(m.material, url, tint, tintAmount);
      }
    });
    return c;
  }, [scene, url, tint, tintAmount, shadows]);
  return <primitive object={obj} />;
}

export type KModelProps = {
  model: ModelKey;
  position?: Vec3;
  rotation?: number | Vec3;
  scale?: number | Vec3;
  fallback?: FallbackKind;
  tint?: string;
  tintAmount?: number;
  shadows?: boolean;
};

/** A single Kenney model with Suspense + error fallback. */
export function KModel({ model, position, rotation, scale = 1, fallback, tint, tintAmount, shadows }: KModelProps) {
  const fb = <PrimitiveFallback kind={fallback ?? guessFallback(model)} />;
  const rot: Vec3 = typeof rotation === "number" ? [0, rotation, 0] : rotation ?? [0, 0, 0];
  return (
    <group position={position} rotation={rot} scale={scale}>
      <ModelBoundary fallback={fb}>
        <Suspense fallback={fb}>
          <LoadedModel url={MODELS[model]} tint={tint} tintAmount={tintAmount} shadows={shadows} />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
export type InstanceItem = { x: number; y: number; z: number; rot: number; scale: number };

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function InstancedParts({ parts, items, castShadow }: { parts: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[]; items: InstanceItem[]; castShadow: boolean }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    parts.forEach((p, pi) => {
      const mesh = refs.current[pi];
      if (!mesh) return;
      items.forEach((it, i) => {
        tmpP.set(it.x, it.y, it.z);
        tmpQ.setFromAxisAngle(UP, it.rot);
        tmpS.setScalar(it.scale);
        tmpM.compose(tmpP, tmpQ, tmpS).multiply(p.matrix);
        mesh.setMatrixAt(i, tmpM);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [parts, items]);
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          args={[p.geometry, p.material, items.length]}
          castShadow={castShadow}
          receiveShadow
        />
      ))}
    </>
  );
}

function LoadedInstances({ url, items, castShadow, tint, tintAmount = 0.5 }: { url: string; items: InstanceItem[]; castShadow: boolean; tint?: string; tintAmount?: number }) {
  const { scene } = useGLTF(url);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.length === 1) out.push({ geometry: m.geometry, material: prepMaterial(mats[0], url, tint, tintAmount), matrix: m.matrixWorld.clone() });
        else {
          // multi-material mesh: split into groups
          m.geometry.groups.forEach((g) => {
            const geo = m.geometry.clone();
            geo.clearGroups();
            geo.setDrawRange(g.start, g.count);
            out.push({ geometry: geo, material: prepMaterial(mats[g.materialIndex ?? 0], url, tint, tintAmount), matrix: m.matrixWorld.clone() });
          });
        }
      }
    });
    return out;
  }, [scene, url, tint, tintAmount]);
  return <InstancedParts parts={parts} items={items} castShadow={castShadow} />;
}

const fallbackGeo: Record<FallbackKind, () => THREE.BufferGeometry> = {
  tree: () => new THREE.ConeGeometry(0.4, 1.4, 6).translate(0, 0.7, 0),
  rock: () => new THREE.DodecahedronGeometry(0.35, 0).translate(0, 0.2, 0),
  bush: () => new THREE.IcosahedronGeometry(0.18, 0).translate(0, 0.12, 0),
  grass: () => new THREE.ConeGeometry(0.12, 0.2, 4).translate(0, 0.1, 0),
  crop: () => new THREE.ConeGeometry(0.1, 0.3, 5).translate(0, 0.15, 0),
  box: () => new THREE.BoxGeometry(0.25, 0.25, 0.25).translate(0, 0.12, 0),
  barrel: () => new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10).translate(0, 0.17, 0),
  tent: () => new THREE.ConeGeometry(0.4, 0.5, 4).translate(0, 0.25, 0),
  house: () => new THREE.BoxGeometry(1, 0.8, 0.9).translate(0, 0.4, 0),
  tool: () => new THREE.BoxGeometry(0.03, 0.25, 0.03).translate(0, 0.12, 0),
  none: () => new THREE.BufferGeometry(),
};
const fallbackColor: Record<FallbackKind, string> = {
  tree: "#6f8a3a", rock: "#8c5a43", bush: "#7c7a3a", grass: "#b8964f", crop: "#7bd389", box: "#9a6b3f",
  barrel: "#9a6b3f", tent: "#d8c7a0", house: "#d9cdb8", tool: "#7d8a92", none: "#ffffff",
};

function FallbackInstances({ kind, items, castShadow }: { kind: FallbackKind; items: InstanceItem[]; castShadow: boolean }) {
  const parts = useMemo(
    () => [{ geometry: fallbackGeo[kind](), material: fbMat(fallbackColor[kind]), matrix: new THREE.Matrix4() }],
    [kind],
  );
  return <InstancedParts parts={parts} items={items} castShadow={castShadow} />;
}

/** Many copies of one Kenney model as InstancedMeshes (one draw call per mesh part). */
export function InstancedModel({ model, items, castShadow = false, fallback, tint, tintAmount }: { model: ModelKey; items: InstanceItem[]; castShadow?: boolean; fallback?: FallbackKind; tint?: string; tintAmount?: number }) {
  if (items.length === 0) return null;
  const fb = <FallbackInstances kind={fallback ?? guessFallback(model)} items={items} castShadow={castShadow} />;
  return (
    <ModelBoundary fallback={fb}>
      <Suspense fallback={null}>
        <LoadedInstances url={MODELS[model]} items={items} castShadow={castShadow} tint={tint} tintAmount={tintAmount} />
      </Suspense>
    </ModelBoundary>
  );
}

export function preloadModels(keys: ModelKey[]) {
  for (const k of keys) {
    try {
      useGLTF.preload(MODELS[k]);
    } catch {
      /* fallback handles it */
    }
  }
}
