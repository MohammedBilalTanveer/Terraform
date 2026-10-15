// Keyboard state shared by the Explorer and intro. Keys are ignored while the user types in a field.
import { joystick } from "./gameStore";
const pressed = new Set<string>();

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

let installed = 0;
const down = (e: KeyboardEvent) => {
  if (isTypingTarget(e.target)) return;
  pressed.add(e.code);
};
const up = (e: KeyboardEvent) => {
  pressed.delete(e.code);
};
const blur = () => pressed.clear();

export function installKeyboard(): () => void {
  if (installed++ === 0) {
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
  }
  return () => {
    if (--installed === 0) {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      pressed.clear();
    }
  };
}

export function clearKeys() {
  pressed.clear();
}

export const keyDown = (...codes: string[]) => codes.some((c) => pressed.has(c));

/** Movement vector in world space (camera looks north, so screen-up = -z). */
export function readMoveInput(): { x: number; z: number; sprint: boolean } {
  let x = 0;
  let z = 0;
  if (keyDown("KeyW", "ArrowUp")) z -= 1;
  if (keyDown("KeyS", "ArrowDown")) z += 1;
  if (keyDown("KeyA", "ArrowLeft")) x -= 1;
  if (keyDown("KeyD", "ArrowRight")) x += 1;
  return { x, z, sprint: keyDown("ShiftLeft", "ShiftRight") || joystick.sprint };
}
