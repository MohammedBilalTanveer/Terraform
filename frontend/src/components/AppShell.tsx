import type { ReactNode } from "react";
import { useTerraform } from "../store/terraformStore";
import Background from "./Background";
import EvidenceDrawer from "./EvidenceDrawer";
import ModeSwitcher from "./ModeSwitcher";
import RestartButton from "./RestartButton";
import HeaderMenu from "./HeaderMenu";
import { BackendPill, GenerationModePill, KbOnlyPill, KbPill, SavePill } from "./StatusPills";
import Toasts from "./Toasts";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center" aria-hidden>
        <span className="absolute inset-0 rotate-45 rounded-lg bg-gradient-to-br from-cyan via-violet to-terracotta opacity-90" />
        <span className="absolute inset-[3px] rotate-45 rounded-[0.4rem] bg-midnight" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan to-violet shadow-[0_0_12px_rgba(56,225,255,0.9)]" />
      </span>
      <span className={size === "lg" ? "font-display text-2xl font-black tracking-[0.25em]" : "font-display text-sm font-black tracking-[0.2em] sm:text-base sm:tracking-[0.28em]"}>
        <span className="text-gradient-cv">TERRA</span>
        <span className="text-ivory">FORM</span>
      </span>
    </span>
  );
}

export default function AppShell({ children, showStatus = true }: { children: ReactNode; showStatus?: boolean }) {
  const setMode = useTerraform((s) => s.setMode);
  const reduce = useTerraform((s) => s.reduceMotion);
  return (
    <div className={reduce ? "tap-scope reduce-motion relative isolate min-h-screen" : "tap-scope relative isolate min-h-screen"}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-cyan focus:px-3 focus:py-2 focus:text-midnight">
        Skip to content
      </a>
      <Background />
      <header className="app-header sticky top-0 z-40 border-b border-white/8 bg-midnight/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-3 sm:gap-4 lg:px-6">
          <button type="button" onClick={() => setMode("landing")} className="shrink-0 rounded-lg" aria-label="TERRAFORM home">
            <Logo />
          </button>
          <div className="hidden min-w-0 border-l border-white/10 pl-4 sm:block">
            <div className="eyebrow !text-[0.75rem]">The System Awakens</div>
            <div className="truncate font-heading text-sm font-semibold text-ivory">Scenario 5 · Lateritic Hardpan Plateau</div>
          </div>
          {showStatus && (
            <div className="ml-auto hidden flex-wrap items-center justify-end gap-1.5 xl:flex" aria-label="System status">
              <BackendPill />
              <KbPill />
              <KbOnlyPill />
              <GenerationModePill />
              <SavePill />
            </div>
          )}
          <div className="ml-auto hidden shrink-0 lg:block xl:ml-2">
            <RestartButton />
          </div>
          <ModeSwitcher className="hidden shrink-0 lg:flex" />
          <HeaderMenu className="ml-auto shrink-0 lg:hidden" />
        </div>
        {showStatus && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-white/5 px-4 py-2 xl:hidden" aria-label="System status">
            <span className="shrink-0 font-heading text-xs text-mist sm:hidden">Scenario 5 · Lateritic Hardpan</span>
            <BackendPill />
            <KbPill />
            <KbOnlyPill />
            <GenerationModePill />
            <SavePill />
          </div>
        )}
      </header>
      {children}
      <EvidenceDrawer />
      <Toasts />
    </div>
  );
}
