import { Cloud, CloudOff, Cpu, Database, LoaderCircle, Save, ShieldCheck, ShieldQuestion, Wifi, WifiOff } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { Badge } from "./ui";
import { useGenerationMode } from "./workflow";

export function BackendPill() {
  const online = useTerraform((s) => s.backendOnline);
  if (online === null)
    return <Badge tone="stone" icon={<LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />}>Connecting…</Badge>;
  return online ? (
    <Badge tone="cyan" icon={<Wifi className="h-3 w-3" aria-hidden />} title="Backend reachable">Backend online</Badge>
  ) : (
    <Badge tone="coral" icon={<WifiOff className="h-3 w-3" aria-hidden />} title="Backend not reachable">Backend offline</Badge>
  );
}

export function KbPill() {
  const health = useTerraform((s) => s.health);
  const online = useTerraform((s) => s.backendOnline);
  if (!health || online === false) return <Badge tone="stone" icon={<Database className="h-3 w-3" aria-hidden />}>KB status unknown</Badge>;
  if (!health.kb_loaded)
    return (
      <Badge tone="coral" icon={<Database className="h-3 w-3" aria-hidden />} title={health.kb_errors?.join("\n")}>
        KB not loaded
      </Badge>
    );
  return (
    <Badge tone="violet" icon={<Database className="h-3 w-3" aria-hidden />} title={health.kb_errors?.length ? health.kb_errors.join("\n") : "Knowledge base loaded"}>
      KB v{health.kb_version} · {health.kb_record_count} records{health.kb_errors?.length ? ` · ${health.kb_errors.length} warnings` : ""}
    </Badge>
  );
}

export function KbOnlyPill() {
  const health = useTerraform((s) => s.health);
  if (!health) return <Badge tone="stone" icon={<ShieldQuestion className="h-3 w-3" aria-hidden />}>KB-only: unknown</Badge>;
  return health.kb_only_mode ? (
    <Badge tone="sprout" icon={<ShieldCheck className="h-3 w-3" aria-hidden />} title="Every recommendation is selected from the knowledge base">
      KB-only mode
    </Badge>
  ) : (
    <Badge tone="amber" icon={<ShieldQuestion className="h-3 w-3" aria-hidden />}>KB-only mode off</Badge>
  );
}

export function GenerationModePill() {
  const { mode, source } = useGenerationMode();
  if (!mode) return null;
  return (
    <Badge tone="stone" icon={<Cpu className="h-3 w-3" aria-hidden />} title={source === "default" ? "Backend default generation mode" : `Generation mode of the latest ${source} response`}>
      {mode === "llm_rewrite" ? "LLM rewrite" : "Deterministic"}
      {source === "default" ? " (default)" : ""}
    </Badge>
  );
}

export function SavePill() {
  const status = useTerraform((s) => s.saveStatus);
  const map = {
    unsaved: { tone: "stone" as const, icon: <Save className="h-3 w-3" aria-hidden />, label: "Unsaved" },
    saving: { tone: "cyan" as const, icon: <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />, label: "Saving…" },
    saved: { tone: "sprout" as const, icon: <Cloud className="h-3 w-3" aria-hidden />, label: "Saved" },
    offline: { tone: "amber" as const, icon: <CloudOff className="h-3 w-3" aria-hidden />, label: "Offline · local only" },
  }[status];
  return (
    <Badge tone={map.tone} icon={map.icon} title="Session save status">
      {map.label}
    </Badge>
  );
}
