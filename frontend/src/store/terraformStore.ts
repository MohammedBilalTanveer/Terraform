// Shared session state for Dashboard and Explorer. The API is the source of truth for every
// recommendation; this store only caches the current session and UI state.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api, ApiError, SCENARIO_ID, getBackendStatus, subscribeBackend, waitForBackend } from "../api/terraformApi";
import { harvestRequirements, taskLockFor } from "./workflowRules";
import type {
  AnalysisResponse,
  AppMode,
  HealthResponse,
  ObservationInput,
  PlanResponse,
  StepId,
} from "../types/terraform";

export type SaveStatus = "unsaved" | "saving" | "saved" | "offline";

type Toast = { id: number; kind: "info" | "success" | "error"; text: string };

export type TerraformState = {
  // navigation
  mode: AppMode;
  currentStep: StepId;
  introSeen: boolean;
  reduceMotion: boolean;

  // backend status
  health: HealthResponse | null;
  backendOnline: boolean | null;

  // session
  sessionId: string | null;
  scenarioId: string;
  observation: ObservationInput | null;
  photoPreviewUrl: string | null;
  analysis: AnalysisResponse | null;
  plan: PlanResponse | null;
  selectedCropId: string | null;
  completedTasks: string[];
  acceptedRisks: string[];
  checkOutcomes: { check_id: string; outcome_id: string }[];
  /** Checks the user reported they were unable to perform (UI-only; not sent as an outcome). */
  unableChecks: string[];
  /** Empirical readiness-gate test results recorded by the user (v1.1). */
  gateResults: Record<string, "pass" | "fail">;
  journal: { at: string; text: string }[];
  /** set when the crop is harvested → shows the "Season complete" ending */
  harvestedAt: string | null;
  season: number;
  saveStatus: SaveStatus;

  // async
  loading: null | "analyze" | "plan" | "progress" | "upload" | "session";
  error: string | null;

  // UI
  evidenceKbId: string | null;
  toasts: Toast[];
  /** the server answered health but is not fully ready yet (e.g. still loading the knowledge base) */
  backendAnswered: boolean;

  // actions
  setMode: (mode: AppMode) => void;
  setCurrentStep: (step: StepId) => void;
  setIntroSeen: (v: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  checkHealth: () => Promise<void>;
  ensureSession: () => Promise<string | null>;
  setObservation: (o: ObservationInput) => void;
  setPhotoPreviewUrl: (url: string | null) => void;
  analyze: (o?: ObservationInput) => Promise<AnalysisResponse | null>;
  generatePlan: () => Promise<PlanResponse | null>;
  setCheckOutcome: (check_id: string, outcome_id: string | null) => Promise<void>;
  setCheckUnable: (check_id: string, unable: boolean) => Promise<void>;
  selectCrop: (cropId: string) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  acceptRisk: (gateId: string) => Promise<void>;
  setGateResult: (gateId: string, result: "pass" | "fail" | null) => Promise<void>;
  addJournal: (text: string) => Promise<void>;
  openEvidence: (kbId: string | null) => void;
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  clearError: () => void;
  resetSession: () => void;
  markHarvested: () => void;
  dismissEnding: () => void;
  /** keep land notes + journal, clear the season's plan/tasks/tests/crop, and start planning season N+1 */
  startNextSeason: () => void;
  endingOpen: boolean;
};

let toastSeq = 1;

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : (e as Error)?.message ?? "Unknown error");

export const useTerraform = create<TerraformState>()(
  persist(
    (set, get) => {
      // ───────── self-healing (the free hosting tier wipes the backend's session/plan store on sleep) ─────────
      const isNotFound = (e: unknown) => e instanceof ApiError && (e.status === 404 || /NOT_FOUND/i.test(e.code));

      /** Rebuild the server-side session + plan from what the browser still holds. Silent: no loading/error state. */
      let restoring: Promise<void> | null = null;
      const restoreServerState = (): Promise<void> => {
        if (restoring) return restoring;
        restoring = (async () => {
          const sessionId = await get().ensureSession(); // keeps the id if the server still knows it, else makes a new one
          if (!sessionId) throw new ApiError("Cannot reach the TERRAFORM backend to restore your progress.", "NETWORK", true);
          const s = get();
          if (s.plan && s.observation) {
            const plan = await api.generatePlan({
              observation: { ...s.observation, user_confirmed_checks: s.checkOutcomes },
              session_id: sessionId,
              selected_crop_id: s.selectedCropId,
              completed_tasks: s.completedTasks,
              accepted_risks: s.acceptedRisks,
              gate_results: s.gateResults,
            });
            set({ plan, completedTasks: plan.completed_tasks ?? get().completedTasks });
          }
        })().finally(() => {
          restoring = null;
        });
        return restoring;
      };

      let lastRestoreToast = 0;
      /** Run `op`; on a 404 restore the server state and retry ONCE. `op` must read fresh ids via get(). */
      async function healAndRetry<T>(op: () => Promise<T>, opts: { toastOnFail?: boolean } = {}): Promise<T> {
        try {
          return await op();
        } catch (e) {
          if (!isNotFound(e)) throw e;
          try {
            await restoreServerState();
          } catch (re) {
            if (opts.toastOnFail) get().toast("error", errMsg(re));
            throw re;
          }
          const result = await op(); // single retry — a second 404 propagates to the caller
          if (Date.now() - lastRestoreToast > 10000) {
            lastRestoreToast = Date.now();
            get().toast("info", "The server restarted — your progress was restored.");
          }
          return result;
        }
      }

      const syncSession = async () => {
        if (!get().sessionId) {
          set({ saveStatus: "unsaved" });
          return;
        }
        set({ saveStatus: "saving" });
        try {
          await healAndRetry(
            () => {
              const s = get();
              return api.updateSession(s.sessionId ?? "", {
                observation: s.observation,
                plan_id: s.plan?.plan_id ?? null,
                selected_crop_id: s.selectedCropId,
                completed_tasks: s.completedTasks,
                accepted_risks: s.acceptedRisks,
                check_outcomes: s.checkOutcomes,
                journal: s.journal,
                current_step: s.currentStep,
                gate_results: s.gateResults,
              });
            },
            { toastOnFail: true },
          );
          set({ saveStatus: "saved" });
        } catch {
          set({ saveStatus: "offline" });
        }
      };

      return {
        mode: "landing",
        currentStep: "observation_log",
        introSeen: false,
        reduceMotion: false,
        health: null,
        backendOnline: null,
        sessionId: null,
        scenarioId: SCENARIO_ID,
        observation: null,
        photoPreviewUrl: null,
        analysis: null,
        plan: null,
        selectedCropId: null,
        completedTasks: [],
        acceptedRisks: [],
        checkOutcomes: [],
        unableChecks: [],
        gateResults: {},
        journal: [],
        harvestedAt: null,
        season: 1,
        endingOpen: false,
        saveStatus: "unsaved",
        loading: null,
        error: null,
        evidenceKbId: null,
        toasts: [],
        backendAnswered: false,

        setMode: (mode) => set({ mode }),
        setCurrentStep: (currentStep) => {
          set({ currentStep });
          void syncSession();
        },
        setIntroSeen: (introSeen) => set({ introSeen }),
        setReduceMotion: (reduceMotion) => set({ reduceMotion }),

        // Probe now; if the backend is asleep the shared poller (api.waitForBackend) takes over and the
        // global BackendGate shows until it answers. Status flows back through subscribeBackend below.
        checkHealth: async () => {
          try {
            await api.health();
          } catch {
            void waitForBackend();
          }
        },

        ensureSession: async () => {
          const existing = get().sessionId;
          if (existing) {
            try {
              await api.getSession(existing);
              return existing;
            } catch {
              /* fall through and create a new one */
            }
          }
          try {
            const s = await api.createSession();
            set({ sessionId: s.session_id, saveStatus: "saved" });
            return s.session_id;
          } catch {
            set({ saveStatus: "offline" });
            return null;
          }
        },

        setObservation: (observation) => set({ observation }),
        setPhotoPreviewUrl: (photoPreviewUrl) => set({ photoPreviewUrl }),

        analyze: async (o) => {
          const observation = o ?? get().observation;
          if (!observation) return null;
          if (get().loading) return null;
          set({ loading: "analyze", error: null, observation });
          try {
            const sessionId = await get().ensureSession();
            const withChecks: ObservationInput = { ...observation, user_confirmed_checks: get().checkOutcomes };
            let analysis;
            try {
              analysis = await api.analyze(withChecks, sessionId);
            } catch (e) {
              if (!isNotFound(e)) throw e;
              set({ sessionId: null });
              analysis = await api.analyze(withChecks, await get().ensureSession());
            }
            set({ analysis, sessionId: analysis.session_id ?? get().sessionId, loading: null });
            void syncSession();
            return analysis;
          } catch (e) {
            set({ loading: null, error: errMsg(e) });
            return null;
          }
        },

        generatePlan: async () => {
          const { observation } = get();
          if (!observation) return null;
          set({ loading: "plan", error: null });
          try {
            const build = (sid: string | null) =>
              api.generatePlan({
                observation: { ...observation, user_confirmed_checks: get().checkOutcomes },
                session_id: sid,
                selected_crop_id: get().selectedCropId,
                completed_tasks: get().completedTasks,
                accepted_risks: get().acceptedRisks,
                gate_results: get().gateResults,
              });
            let plan;
            try {
              plan = await build(await get().ensureSession());
            } catch (e) {
              if (!isNotFound(e)) throw e;
              set({ sessionId: null });
              plan = await build(await get().ensureSession());
            }
            set({ plan, loading: null, completedTasks: plan.completed_tasks ?? get().completedTasks });
            void syncSession();
            return plan;
          } catch (e) {
            set({ loading: null, error: errMsg(e) });
            return null;
          }
        },

        setCheckOutcome: async (check_id, outcome_id) => {
          const rest = get().checkOutcomes.filter((c) => c.check_id !== check_id);
          const checkOutcomes = outcome_id ? [...rest, { check_id, outcome_id }] : rest;
          set({ checkOutcomes });
          // Re-analyse so check outcomes become observed facts (e.g. patchy vs continuous hardpan).
          await get().analyze();
          if (get().plan) await get().generatePlan();
        },

        setCheckUnable: async (check_id, unable) => {
          const rest = get().unableChecks.filter((c) => c !== check_id);
          set({ unableChecks: unable ? [...rest, check_id] : rest });
          // "Unable to do" means no outcome is known — clear any previous outcome for this check.
          if (unable && get().checkOutcomes.some((c) => c.check_id === check_id)) {
            await get().setCheckOutcome(check_id, null);
          }
        },

        selectCrop: async (cropId) => {
          set({ selectedCropId: cropId });
          await get().generatePlan(); // care + harvest depend on the selected crop
          get().toast("success", "Crop selected — care and harvest guidance updated.");
        },

        toggleTask: async (taskId) => {
          const prevTasks = get().completedTasks;
          const done = prevTasks.includes(taskId);
          if (!done) {
            // v1.4: plant-phase tasks stay locked until a crop is chosen and the readiness gate has passed.
            const lock = taskLockFor(taskId, get().plan, get().selectedCropId);
            if (lock.locked) {
              get().toast("info", lock.message ?? "This task is locked.");
              return;
            }
          }
          set({ completedTasks: done ? prevTasks.filter((t) => t !== taskId) : [...prevTasks, taskId] });
          const planId = get().plan?.plan_id;
          if (planId) {
            try {
              const res = await healAndRetry(() => api.updateProgress(get().plan?.plan_id ?? planId, { task_id: taskId, completed: !done }));
              const cur = get().plan;
              set({
                completedTasks: res.completed_tasks,
                acceptedRisks: res.accepted_risks,
                ...(res.gate_results ? { gateResults: res.gate_results } : {}),
                ...(cur
                  ? {
                      plan: {
                        ...cur,
                        completed_tasks: res.completed_tasks,
                        steps_status: res.steps_status,
                        workflow: {
                          ...cur.workflow,
                          next_action: {
                            ...cur.workflow.next_action,
                            readiness_gate: res.readiness_gate,
                            planting_readiness: res.planting_readiness,
                          },
                        },
                      },
                    }
                  : {}),
              });
              get().toast("success", done ? "Task reopened" : "Task marked complete");
            } catch (e) {
              // 409 (e.g. TASK_LOCKED): the server refused — undo the optimistic tick and show its message.
              if (e instanceof ApiError && e.status === 409) set({ completedTasks: prevTasks });
              get().toast("error", errMsg(e));
            }
          }
          void syncSession();
        },

        acceptRisk: async (gateId) => {
          const planId = get().plan?.plan_id;
          if (!planId) return;
          try {
            const res = await healAndRetry(() => api.updateProgress(get().plan?.plan_id ?? planId, { accept_risk_gate_id: gateId }));
            const cur = get().plan;
            set({
              acceptedRisks: res.accepted_risks,
              ...(res.gate_results ? { gateResults: res.gate_results } : {}),
              ...(cur
                ? {
                    plan: {
                      ...cur,
                      steps_status: res.steps_status,
                      workflow: {
                        ...cur.workflow,
                        next_action: {
                          ...cur.workflow.next_action,
                          readiness_gate: res.readiness_gate,
                          planting_readiness: res.planting_readiness,
                        },
                      },
                    },
                  }
                : {}),
            });
            get().toast("info", "Risk accepted — shown as an open uncertainty.");
          } catch (e) {
            get().toast("error", errMsg(e));
          }
          void syncSession();
        },

        setGateResult: async (gateId, result) => {
          const prev = get().gateResults;
          const next = { ...prev };
          if (result) next[gateId] = result;
          else delete next[gateId];
          set({ gateResults: next });
          const planId = get().plan?.plan_id;
          if (planId) {
            try {
              const res = await healAndRetry(() =>
                api.updateProgress(get().plan?.plan_id ?? planId, { gate_result: { gate_id: gateId, result } }),
              );
              const cur = get().plan;
              set({
                completedTasks: res.completed_tasks ?? get().completedTasks,
                acceptedRisks: res.accepted_risks ?? get().acceptedRisks,
                gateResults: res.gate_results ?? next,
                ...(cur
                  ? {
                      plan: {
                        ...cur,
                        completed_tasks: res.completed_tasks ?? cur.completed_tasks,
                        steps_status: res.steps_status ?? cur.steps_status,
                        workflow: {
                          ...cur.workflow,
                          next_action: {
                            ...cur.workflow.next_action,
                            readiness_gate: res.readiness_gate ?? cur.workflow.next_action.readiness_gate,
                            planting_readiness: res.planting_readiness ?? cur.workflow.next_action.planting_readiness,
                          },
                        },
                      },
                    }
                  : {}),
              });
              get().toast(result === "fail" ? "info" : "success", result ? `Test recorded: ${result.toUpperCase()}` : "Test result cleared");
            } catch (e) {
              set({ gateResults: prev });
              get().toast("error", errMsg(e));
            }
          }
          void syncSession();
        },

        addJournal: async (text) => {
          set({ journal: [...get().journal, { at: new Date().toISOString(), text }] });
          await syncSession();
        },

        openEvidence: (evidenceKbId) => set({ evidenceKbId }),
        toast: (kind, text) => {
          const id = toastSeq++;
          set({ toasts: [...get().toasts, { id, kind, text }] });
          setTimeout(() => get().dismissToast(id), 3500);
        },
        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
        clearError: () => set({ error: null }),
        markHarvested: () => {
          if (get().harvestedAt) {
            set({ endingOpen: true });
            return;
          }
          // v1.4: a harvest can only be recorded after a crop was chosen, the gate passed and the sowing task is done.
          const req = harvestRequirements(get().plan, get().selectedCropId, get().completedTasks);
          if (!req.ok) {
            get().toast("info", `Not yet — still missing: ${req.missing.map((m) => m.label.toLowerCase()).join(", ")}.`);
            return;
          }
          const at = new Date().toISOString();
          set({ harvestedAt: at, endingOpen: true, currentStep: "harvest" });
          void get().addJournal(`Season ${get().season}: harvest completed.`);
        },
        dismissEnding: () => set({ endingOpen: false }),
        startNextSeason: () => {
          const next = get().season + 1;
          set({
            season: next,
            harvestedAt: null,
            endingOpen: false,
            analysis: null,
            plan: null,
            selectedCropId: null,
            completedTasks: [],
            acceptedRisks: [],
            checkOutcomes: [],
            unableChecks: [],
            gateResults: {},
            currentStep: "observation_log",
            journal: [...get().journal, { at: new Date().toISOString(), text: `Season ${next} started — update your land description with what changed.` }],
          });
          void syncSession();
        },
        resetSession: () =>
          set({
            harvestedAt: null,
            season: 1,
            endingOpen: false,
            sessionId: null,
            observation: null,
            photoPreviewUrl: null,
            analysis: null,
            plan: null,
            selectedCropId: null,
            completedTasks: [],
            acceptedRisks: [],
            checkOutcomes: [],
            unableChecks: [],
            gateResults: {},
            journal: [],
            currentStep: "observation_log",
            saveStatus: "unsaved",
            error: null,
          }),
      };
    },
    {
      name: "terraform-session-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sessionId: s.sessionId,
        observation: s.observation,
        analysis: s.analysis,
        plan: s.plan,
        selectedCropId: s.selectedCropId,
        completedTasks: s.completedTasks,
        acceptedRisks: s.acceptedRisks,
        checkOutcomes: s.checkOutcomes,
        unableChecks: s.unableChecks,
        gateResults: s.gateResults,
        journal: s.journal,
        harvestedAt: s.harvestedAt,
        season: s.season,
        currentStep: s.currentStep,
        introSeen: s.introSeen,
        reduceMotion: s.reduceMotion,
        // a reload returns to the same screen; a half-watched intro resumes as the explorer
        mode: s.mode === "intro" ? "explorer" : s.mode,
      }),
    },
  ),
);

// Connectivity lives in the API layer (one source of truth: requests + the shared wake-up poll) and flows into the store.
const applyBackend = (b: ReturnType<typeof getBackendStatus>) =>
  useTerraform.setState({ backendOnline: b.online, backendAnswered: b.answered, ...(b.health ? { health: b.health } : {}) });
applyBackend(getBackendStatus());
subscribeBackend(applyBackend);
