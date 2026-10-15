// The lateritic plateau: terrain, golden-hour sky + light, scatter, stations and the farm plot.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { InstancedModel } from "./assets";
import { colorAt, heightAt } from "./terrain";
import { getScatter } from "./scatter";
import { POND, WORLD } from "./worldConfig";
import StationProps from "./StationProps";
import { DustMotes } from "./Effects";

const tmpColor = new THREE.Color();

export function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const c = colorAt(x, z, h);
      // colours are authored in sRGB; vertex colours are linear
      tmpColor.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  );
}

export function SkyDome({ top = "#5b6fa8", mid = "#f0a86a", bottom = "#e98f5c" }: { top?: string; mid?: string; bottom?: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(top) },
          mid: { value: new THREE.Color(mid) },
          bottom: { value: new THREE.Color(bottom) },
          sunDir: { value: new THREE.Vector3(-0.55, 0.28, -0.75).normalize() },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
          void main(){ float h = vDir.y; vec3 c = mix(mid, top, smoothstep(0.02, 0.55, h)); c = mix(bottom, c, smoothstep(-0.2, 0.05, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0,0.75,0.45) * pow(s, 24.0) * 0.6 + vec3(1.0,0.6,0.3)*pow(s,4.0)*0.15;
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    [top, mid, bottom],
  );
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 24, 12]} />
    </mesh>
  );
}

/** Warm directional sun whose shadow frustum follows a target (keeps a small, cheap shadow map). */
export function GoldenHourLights({ follow }: { follow: { x: number; z: number } }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    return () => void scene.remove(l.target);
  }, [scene]);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    l.position.set(follow.x + 22, 26, follow.z + 16);
    l.target.position.set(follow.x, 0, follow.z);
    l.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={["#e3e9ff", "#7a4030", 0.95]} />
      <ambientLight intensity={0.08} color="#ffe7cc" />
      <directionalLight
        ref={light}
        color="#ffd3a3"
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}

function Pond() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshStandardMaterial).opacity = 0.8 + Math.sin(clock.elapsedTime * 0.8) * 0.04;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, heightAt(POND.x, POND.z) + 0.75, POND.z]} receiveShadow>
      <circleGeometry args={[POND.r - 0.4, 32]} />
      <meshStandardMaterial color="#4f8a8b" roughness={0.15} metalness={0.1} transparent opacity={0.82} />
    </mesh>
  );
}

function ScatterLayer() {
  const scatter = useMemo(() => getScatter(), []);
  return (
    <>
      {scatter.groups.map((g) => (
        <InstancedModel key={`${g.model}-${g.tint ?? ""}`} model={g.model} items={g.items} castShadow={g.castShadow} tint={g.tint} tintAmount={g.tintAmount} />
      ))}
    </>
  );
}

export default function WorldScene({ follow, reduceMotion = false, showStations = true }: { follow: { x: number; z: number; y?: number }; reduceMotion?: boolean; showStations?: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog("#d9a27e", 40, 140);
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  return (
    <>
      <SkyDome />
      <GoldenHourLights follow={follow} />
      <Terrain />
      <Pond />
      <ScatterLayer />
      {showStations && <StationProps reduceMotion={reduceMotion} />}
      <DustMotes follow={follow} reduceMotion={reduceMotion} count={reduceMotion ? 60 : 180} />
    </>
  );
}
