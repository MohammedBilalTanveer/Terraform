// Shared session state for Dashboard and Explorer. The API is the source of truth for every
// recommendation; this store only caches the current session and UI state.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api, ApiError, SCENARIO_ID } from "../api/terraformApi";
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
      const syncSession = async () => {
        const s = get();
        if (!s.sessionId) {
          set({ saveStatus: "unsaved" });
          return;
        }
        set({ saveStatus: "saving" });
        try {
          await api.updateSession(s.sessionId, {
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

        setMode: (mode) => set({ mode }),
        setCurrentStep: (currentStep) => {
          set({ currentStep });
          void syncSession();
        },
        setIntroSeen: (introSeen) => set({ introSeen }),
        setReduceMotion: (reduceMotion) => set({ reduceMotion }),

        checkHealth: async () => {
          try {
            const health = await api.health();
            set({ health, backendOnline: true });
          } catch {
            set({ backendOnline: false });
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
            const analysis = await api.analyze(withChecks, sessionId);
            set({ analysis, sessionId: analysis.session_id ?? sessionId, loading: null });
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
            const sessionId = await get().ensureSession();
            const plan = await api.generatePlan({
              observation: { ...observation, user_confirmed_checks: get().checkOutcomes },
              session_id: sessionId,
              selected_crop_id: get().selectedCropId,
              completed_tasks: get().completedTasks,
              accepted_risks: get().acceptedRisks,
              gate_results: get().gateResults,
            });
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
          const done = get().completedTasks.includes(taskId);
          const completedTasks = done
            ? get().completedTasks.filter((t) => t !== taskId)
            : [...get().completedTasks, taskId];
          set({ completedTasks });
          const plan = get().plan;
          if (plan) {
            try {
              const res = await api.updateProgress(plan.plan_id, { task_id: taskId, completed: !done });
              set({
                completedTasks: res.completed_tasks,
                acceptedRisks: res.accepted_risks,
                ...(res.gate_results ? { gateResults: res.gate_results } : {}),
                plan: {
                  ...plan,
                  completed_tasks: res.completed_tasks,
                  steps_status: res.steps_status,
                  workflow: {
                    ...plan.workflow,
                    next_action: {
                      ...plan.workflow.next_action,
                      readiness_gate: res.readiness_gate,
                      planting_readiness: res.planting_readiness,
                    },
                  },
                },
              });
              get().toast("success", done ? "Task reopened" : "Task marked complete");
            } catch (e) {
              get().toast("error", errMsg(e));
            }
          }
          void syncSession();
        },

        acceptRisk: async (gateId) => {
          const plan = get().plan;
          if (!plan) return;
          try {
            const res = await api.updateProgress(plan.plan_id, { accept_risk_gate_id: gateId });
            set({
              acceptedRisks: res.accepted_risks,
              ...(res.gate_results ? { gateResults: res.gate_results } : {}),
              plan: {
                ...plan,
                steps_status: res.steps_status,
                workflow: {
                  ...plan.workflow,
                  next_action: {
                    ...plan.workflow.next_action,
                    readiness_gate: res.readiness_gate,
                    planting_readiness: res.planting_readiness,
                  },
                },
              },
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
          const plan = get().plan;
          if (plan) {
            try {
              const res = await api.updateProgress(plan.plan_id, { gate_result: { gate_id: gateId, result } });
              set({
                completedTasks: res.completed_tasks ?? get().completedTasks,
                acceptedRisks: res.accepted_risks ?? get().acceptedRisks,
                gateResults: res.gate_results ?? next,
                plan: {
                  ...plan,
                  completed_tasks: res.completed_tasks ?? plan.completed_tasks,
                  steps_status: res.steps_status ?? plan.steps_status,
                  workflow: {
                    ...plan.workflow,
                    next_action: {
                      ...plan.workflow.next_action,
                      readiness_gate: res.readiness_gate ?? plan.workflow.next_action.readiness_gate,
                      planting_readiness: res.planting_readiness ?? plan.workflow.next_action.planting_readiness,
                    },
                  },
                },
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
