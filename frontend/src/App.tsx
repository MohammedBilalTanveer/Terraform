import { lazy, Suspense, useEffect } from "react";
import { useTerraform } from "./store/terraformStore";
import LandingPage from "./landing/LandingPage";
import SeasonComplete from "./components/SeasonComplete";

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

  useEffect(() => {
    void checkHealth();
    const t = setInterval(() => void checkHealth(), 15000);
    return () => clearInterval(t);
  }, [checkHealth]);

  return (
    <Suspense fallback={<Loading />}>
      {mode === "landing" && <LandingPage />}
      {mode === "intro" && <IntroCinematic />}
      {mode === "dashboard" && <DashboardPage />}
      {mode === "explorer" && <ExplorerPage />}
      <SeasonComplete />
    </Suspense>
  );
}
