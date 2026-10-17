// Three-quarter top-down follow camera: damped, slight look-ahead in movement direction, scroll zoom.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { playerState, useGame } from "./gameStore";
import { stationById } from "./worldConfig";
import { distForAspect, fovForAspect } from "./useViewport";

const OFFSET = new THREE.Vector3(0, 8.6, 10.2);

export default function FollowCamera() {
  const { camera, gl, size } = useThree();
  const look = useRef(new THREE.Vector3(playerState.x, playerState.y, playerState.z));
  const ahead = useRef(new THREE.Vector2());
  const inited = useRef(false);
  const seenTeleport = useRef(playerState.teleportedAt);

  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const g = useGame.getState();
      g.setZoom(g.zoom * (e.deltaY > 0 ? 1.08 : 0.926));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = playerState;
    const g = useGame.getState();
    // look-ahead in the movement direction
    ahead.current.lerp(new THREE.Vector2(p.vx * 0.38, p.vz * 0.3), Math.min(1, dt * 2.2));
    let tx = p.x + ahead.current.x;
    let tz = p.z + ahead.current.y;
    // during an action, frame player + station
    if (g.action?.station) {
      const s = stationById(g.action.station).pos;
      tx = p.x * 0.7 + s[0] * 0.3;
      tz = p.z * 0.7 + s[1] * 0.3;
    }
    const target = new THREE.Vector3(tx, p.y + 0.6, tz);
    // portrait screens see a narrow slice of the world: widen the FOV and pull the camera back a little
    const aspect = size.width / Math.max(1, size.height);
    const pc = camera as THREE.PerspectiveCamera;
    const fov = fovForAspect(42, aspect, 66);
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov = fov;
      pc.updateProjectionMatrix();
    }
    const zoom = (g.action ? g.zoom * 0.82 : g.zoom) * distForAspect(aspect);
    const desired = target.clone().add(OFFSET.clone().multiplyScalar(zoom));
    if (!inited.current || seenTeleport.current !== p.teleportedAt) {
      // first frame, or the player was teleported from the map: jump instead of gliding across the world
      camera.position.copy(desired);
      look.current.copy(target);
      ahead.current.set(0, 0);
      seenTeleport.current = p.teleportedAt;
      inited.current = true;
    }
    const k = 1 - Math.exp(-dt * 4.5);
    camera.position.lerp(desired, k);
    look.current.lerp(target, 1 - Math.exp(-dt * 6));
    camera.lookAt(look.current);
  });
  return null;
}
