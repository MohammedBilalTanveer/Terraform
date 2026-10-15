// "Unknown Land" cultivation plot. Its look is derived entirely from session state:
// unassessed → inspected → planned → prepared (pits/beds) → crop selected → planted → growing → harvest-ready.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { KModel, type ModelKey } from "./assets";
import { heightAt } from "./terrain";
import { stationById } from "./worldConfig";
import { LabelSprite, ParticleBurst, ScanRings } from "./Effects";
import type { WorldView } from "./planData";

const P = stationById("plot").pos;
const W = 9;
const D = 7;

const SLOTS: [number, number][] = [
  [-2.8, -1.6],
  [0, -1.6],
  [2.8, -1.6],
  [-2.8, 1.4],
  [0, 1.4],
  [2.8, 1.4],
];

function plantFor(growth: number, ready: boolean): { model: ModelKey; scale: number } {
  if (ready) return { model: "cornD", scale: 1.7 };
  if (growth < 0.2) return { model: "leafsA", scale: 1.6 };
  if (growth < 0.45) return { model: "leafsB", scale: 1.9 };
  if (growth < 0.75) return { model: "cornB", scale: 1.4 };
  return { model: "cornC", scale: 1.6 };
}

function QuestionMarker() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 2.2 + Math.sin(clock.elapsedTime * 1.6) * 0.15;
    ref.current.rotation.y = clock.elapsedTime * 0.6;
  });
  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.45, 0]} />
        <meshBasicMaterial color="#38e1ff" wireframe toneMapped={false} />
      </mesh>
      <LabelSprite text="?" position={[0, 0, 0]} height={0.7} color="#38e1ff" bg="none" depthTest={false} />
    </group>
  );
}

export default function FarmPlot({ view, reduceMotion }: { view: WorldView; reduceMotion: boolean }) {
  const y = heightAt(P[0], P[1]);
  const st = view.stage;
  const soilColor = st === "unassessed" ? "#b77a55" : st === "inspected" || st === "planned" ? "#93512f" : "#6a3520";
  const ready = st === "harvest_ready";
  const showBeds = view.beds > 0;
  const showPits = view.pits > 0 || (view.prepDone > 0 && !showBeds && view.pots === 0);
  const showPots = view.pots > 0;
  const plant = plantFor(view.growth, ready);
  const corners = useMemo(
    () => [
      [-W / 2, -D / 2],
      [W / 2, -D / 2],
      [-W / 2, D / 2],
      [W / 2, D / 2],
    ] as [number, number][],
    [],
  );

  return (
    <group position={[P[0], y, P[1]]}>
      {/* plot surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshLambertMaterial color={soilColor} />
      </mesh>
      {/* corner stakes + rope */}
      {corners.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.35, cz]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 5]} />
          <meshStandardMaterial color="#e8d9b5" />
        </mesh>
      ))}
      {[
        [0, -D / 2, W, 0],
        [0, D / 2, W, 0],
        [-W / 2, 0, D, Math.PI / 2],
        [W / 2, 0, D, Math.PI / 2],
      ].map(([x, z, len, rot], i) => (
        <mesh key={i} position={[x, 0.55, z]} rotation={[0, rot, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, len, 3]} />
          <meshBasicMaterial color={st === "unassessed" ? "#38e1ff" : "#f6c177"} />
        </mesh>
      ))}

      {st === "unassessed" && <QuestionMarker />}
      {(st === "inspected" || st === "planned") && <ScanRings radius={4.6} active={!reduceMotion} />}

      {/* pits */}
      {showPits &&
        SLOTS.map(([sx, sz], i) => (
          <group key={`pit-${i}`} position={[sx, 0.05, sz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.5, 12]} />
              <meshLambertMaterial color="#2e140b" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[0.5, 0.78, 12]} />
              <meshLambertMaterial color={view.compostDone > 0 ? "#c9a85a" : "#a8603d"} flatShading />
            </mesh>
          </group>
        ))}
      {/* raised beds */}
      {showBeds &&
        [-1.6, 1.4].map((bz, i) => (
          <group key={`bed-${i}`} position={[0, 0, bz]}>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[7.6, 0.4, 1.3]} />
              <meshLambertMaterial color="#7a4a2c" flatShading />
            </mesh>
            <mesh position={[0, 0.41, 0]}>
              <boxGeometry args={[7.3, 0.04, 1.08]} />
              <meshLambertMaterial color={view.compostDone > 0 ? "#3b2416" : "#5a3220"} />
            </mesh>
          </group>
        ))}
      {/* containers */}
      {showPots && [-3.6, 3.6].map((px, i) => <KModel key={`pot-${i}`} model="potLarge" position={[px, 0, -3]} scale={2.6} />)}

      {/* plants */}
      {view.sown &&
        SLOTS.map(([sx, sz], i) => (
          <group key={`plant-${i}`} position={[sx + (showBeds ? (i % 3) * 0.2 : 0), showBeds ? 0.42 : 0.05, sz]}>
            <KModel model={plant.model} scale={plant.scale} rotation={i * 1.3} tint={ready ? "#e8b84a" : undefined} tintAmount={0.55} />
            {showBeds && <KModel model={plant.model} position={[-1.3, 0, 0]} scale={plant.scale * 0.9} rotation={i} tint={ready ? "#e8b84a" : undefined} tintAmount={0.55} />}
          </group>
        ))}
      {ready && (
        <group position={[0, 0.2, 0]}>
          <ParticleBurst active={!reduceMotion} kind="sparkle" count={30} />
        </group>
      )}

      {/* crop sign */}
      {view.cropName && (
        <group position={[W / 2 + 0.6, 0, D / 2 - 0.4]}>
          <KModel model="signpost" scale={3} rotation={-0.5} />
          <LabelSprite text={view.cropName} position={[0, 1.9, 0]} height={0.42} color="#7bd389" />
        </group>
      )}
    </group>
  );
}
