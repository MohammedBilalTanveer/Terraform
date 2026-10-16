// Friendly cold-start / reconnect banner. A sleeping free-tier server needs 30–60 s to wake, so an unreachable
// backend is treated as "waking up" (auto-retry every 5 s, driven by the store) rather than as an error.
import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTerraform } from "../store/terraformStore";

const WAKE_ATTEMPTS = 14; // ≈ 70 s of 5 s retries before the copy turns into "can't reach"

export default function WakeBanner({ className = "" }: { className?: string }) {
  const online = useTerraform((s) => s.backendOnline);
  const attempts = useTerraform((s) => s.healthAttempts);
  const checkHealth = useTerraform((s) => s.checkHealth);
  const [slowFirstCheck, setSlowFirstCheck] = useState(false);

  // The very first health request can hang while the server wakes: show the banner if it takes > 2 s.
  useEffect(() => {
    if (online !== null) return;
    const t = setTimeout(() => setSlowFirstCheck(true), 2000);
    return () => clearTimeout(t);
  }, [online]);

  if (online === true) return null;
  if (online === null && !slowFirstCheck) return null;
  const giveUp = attempts > WAKE_ATTEMPTS;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm ${
        giveUp ? "border-coral/30 bg-coral/10 text-rose-100" : "border-amber/25 bg-amber/10 text-amber-100"
      } ${className}`}
    >
      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      <span className="min-w-0 flex-1">
        {giveUp ? (
          <>
            <strong className="font-heading font-semibold">Still can't reach the server.</strong> It may be offline — we keep retrying automatically.
          </>
        ) : (
          <>
            <strong className="font-heading font-semibold">Waking up the server…</strong> this can take up to a minute. Retrying automatically.
          </>
        )}
      </span>
      <button type="button" onClick={() => void checkHealth()} className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1 text-xs hover:bg-white/10">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry now
      </button>
    </div>
  );
}
