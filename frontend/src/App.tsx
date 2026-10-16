import { lazy, Suspense, useEffect } from "react";
import { useTerraform } from "./store/terraformStore";
import { msSinceHealthy } from "./api/terraformApi";
import LandingPage from "./landing/LandingPage";
import SeasonComplete from "./components/SeasonComplete";
import BackendGate from "./components/BackendGate";

// Heavy 3D code is code-split so the dashboard stays fast on weak laptops.
const DashboardPage = lazy(() => import("./dashboard/DashboardPage"));
const ExplorerPage = lazy(() => import("./game/ExplorerPage"));
const IntroCinematic = lazy(() => import("./intro/IntroCinematic"));

function Loading() {
  return (
    <div className="grid h-screen place-items-center bg-[#070b1a] font-display text-sm tracking-[0.3em] text-cyan-200">
      BOOTING TERRAFORM…
    </div>
  );
}

export default function App() {
  const mode = useTerraform((s) => s.mode);
  const checkHealth = useTerraform((s) => s.checkHealth);

  // First probe on start. If the (free-tier) backend is asleep, BackendGate shows until the shared poller sees it awake.
  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  // Keep-alive: an active user's backend must not fall asleep mid-use (it sleeps after ~15 min idle).
  // Ping every ~8 min while the page is visible and a session has started; also re-check when the tab comes back
  // after a long time away. A failed ping flips the gate on, like any other request.
  useEffect(() => {
    const started = () => {
      const s = useTerraform.getState();
      return !!(s.sessionId || s.observation);
    };
    const ping = () => {
      if (document.hidden || !started()) return;
      void checkHealth();
    };
    const iv = setInterval(ping, 8 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden && started() && msSinceHealthy() > 10 * 60 * 1000) void checkHealth();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkHealth]);

  return (
    <BackendGate>
      <Suspense fallback={<Loading />}>
        {mode === "landing" && <LandingPage />}
        {mode === "intro" && <IntroCinematic />}
        {mode === "dashboard" && <DashboardPage />}
        {mode === "explorer" && <ExplorerPage />}
        <SeasonComplete />
      </Suspense>
    </BackendGate>
  );
}
