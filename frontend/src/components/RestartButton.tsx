// "Restart everything": clears the whole session (observation, plan, tasks, gate tests, journal,
// photo, explorer farm progress, intro flag) after a confirmation, and returns to the start screen.
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useTerraform } from "../store/terraformStore";
import { playerState, useGame } from "../game/gameStore";
import { SPAWN } from "../game/worldConfig";

export function restartEverything() {
  const t = useTerraform.getState();
  t.resetSession();
  t.setIntroSeen(false);
  t.openEvidence(null);
  t.setPhotoPreviewUrl(null);
  useGame.setState({
    overlay: null,
    action: null,
    targetOverride: null,
    farm: { key: null, sown: false, careIdx: 0, harvested: false },
  });
  Object.assign(playerState, { x: SPAWN[0], z: SPAWN[1], vx: 0, vz: 0, speed: 0, rot: Math.PI });
  try {
    localStorage.removeItem("terraform-explorer-v1");
  } catch {
    /* storage unavailable — in-memory state is already reset */
  }
  t.setMode("landing");
  t.toast("success", "Everything was reset — a fresh expedition starts now.");
}

export default function RestartButton({ variant = "pill", className = "" }: { variant?: "pill" | "menu"; className?: string }) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "menu"
      ? "flex w-full items-center gap-2.5 rounded-xl border border-rose-300/30 bg-rose-400/[0.06] px-3 py-2.5 text-left text-[13.5px] text-rose-100 hover:border-rose-300/60 hover:bg-rose-400/[0.12]"
      : "inline-flex items-center gap-1.5 rounded-lg border border-rose-300/30 bg-rose-400/10 px-2.5 py-1.5 text-xs font-medium text-rose-100 hover:border-rose-300/60 hover:bg-rose-400/20";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${cls} ${className}`} aria-label="Restart everything">
        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden /> Restart
      </button>
      <ConfirmDialog
        open={open}
        title="Restart everything?"
        confirmLabel="Yes, restart"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          restartEverything();
        }}
      >
        This clears your land description, photo, checks, plan, completed tasks, readiness tests, journal and
        3D farm progress, and replays the intro. The knowledge base itself is not changed.
      </ConfirmDialog>
    </>
  );
}
