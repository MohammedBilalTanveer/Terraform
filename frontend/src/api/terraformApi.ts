// Single typed API client. Every request goes through `request()` (timeout, error parsing, offline message).
import type {
  AnalysisResponse,
  AskResponse,
  HealthResponse,
  KbRecordResponse,
  ObservationInput,
  PhotoAnalyzeResponse,
  PhotoUploadResponse,
  PlanResponse,
  ProgressResponse,
  SessionState,
} from "../types/terraform";

// Backend URL, in priority order:
//  1. runtime config from /config.js (production: set API_BASE_URL on the frontend web service — no rebuild)
//  2. build-time VITE_API_BASE_URL (frontend/.env)
//  3. local default
declare global {
  interface Window {
    __TERRAFORM_CONFIG__?: { apiBaseUrl?: string };
  }
}
const normalizeBaseUrl = (u: string) => {
  const v = u.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
const runtimeBase = typeof window !== "undefined" ? window.__TERRAFORM_CONFIG__?.apiBaseUrl : undefined;
const buildBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL: string = runtimeBase
  ? normalizeBaseUrl(runtimeBase)
  : buildBase
    ? normalizeBaseUrl(buildBase)
    : "http://127.0.0.1:8000";

export const SCENARIO_ID = "scenario_05_lateritic_hardpan";

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;
  constructor(message: string, code = "UNKNOWN", retryable = true, status = 0) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

// ───────────────────────── backend connectivity (free hosting sleeps when idle) ─────────────────────────
// The API layer owns "is the backend awake?". The store subscribes (see terraformStore.ts) and the global
// BackendGate shows whenever it is not. Requests that hit a sleeping/restarting server wait for it and retry once.
export type BackendStatus = { online: boolean | null; health: HealthResponse | null; answered: boolean };
let backendStatus: BackendStatus = { online: null, health: null, answered: false };
const statusListeners = new Set<(s: BackendStatus) => void>();

function setBackendStatus(next: Partial<BackendStatus>) {
  const merged = { ...backendStatus, ...next };
  const changed = merged.online !== backendStatus.online || merged.health !== backendStatus.health || merged.answered !== backendStatus.answered;
  backendStatus = merged;
  if (changed) statusListeners.forEach((l) => l(backendStatus));
}
export const getBackendStatus = () => backendStatus;
export function subscribeBackend(l: (s: BackendStatus) => void) {
  statusListeners.add(l);
  return () => void statusListeners.delete(l);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Network failure, timeout, or the hosting proxy answering 502/503/504 for a sleeping service. */
const isTransient = (e: unknown) =>
  e instanceof ApiError && (e.code === "NETWORK" || e.code === "TIMEOUT" || e.status === 502 || e.status === 503 || e.status === 504);

let lastHealthyAt = 0;
export const msSinceHealthy = () => (lastHealthyAt ? Date.now() - lastHealthyAt : Infinity);

/** One health probe with its own generous timeout (a cold start can take a while to answer). Never gated. */
async function probeHealth(timeoutMs = 10000): Promise<HealthResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new ApiError(`Health check failed (${res.status})`, `HTTP_${res.status}`, true, res.status);
    const health = (await res.json()) as HealthResponse;
    return health;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Cannot reach the TERRAFORM backend.", (e as Error).name === "AbortError" ? "TIMEOUT" : "NETWORK", true);
  } finally {
    clearTimeout(timer);
  }
}

/** How long a server that answers but reports "knowledge base not loaded" is waited for before we carry on anyway. */
const KB_GRACE_MS = 45000;
let answeredAt = 0;

/** Probe once and publish the result. Resolves with the health payload when the backend counts as awake. */
async function checkBackendOnce(): Promise<HealthResponse> {
  try {
    const health = await probeHealth();
    if (!answeredAt) answeredAt = Date.now();
    const kbPending = health.kb_loaded === false && Date.now() - answeredAt < KB_GRACE_MS;
    if (kbPending) {
      setBackendStatus({ online: false, health, answered: true });
      throw new ApiError("The server is up but is still loading the knowledge base.", "KB_LOADING", true, 0);
    }
    answeredAt = 0;
    lastHealthyAt = Date.now();
    setBackendStatus({ online: true, health, answered: false });
    return health;
  } catch (e) {
    if (e instanceof ApiError && e.code === "KB_LOADING") throw e;
    answeredAt = 0;
    setBackendStatus({ online: false, answered: false });
    throw e;
  }
}

let waiting: Promise<boolean> | null = null;
/**
 * Poll /api/health every 3 s (10 s per try) until the backend is awake or `maxMs` passes.
 * ONE shared poll no matter how many callers wait. Timers only (no rAF), so it also runs in background tabs.
 */
export function waitForBackend(maxMs = 150000): Promise<boolean> {
  if (waiting) return waiting;
  waiting = (async () => {
    const start = Date.now();
    for (;;) {
      try {
        await checkBackendOnce();
        return true;
      } catch {
        /* keep waiting */
      }
      if (Date.now() - start >= maxMs) return false;
      await sleep(3000);
    }
  })().finally(() => {
    waiting = null;
  });
  return waiting;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const once = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        signal: controller.signal,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null; // e.g. an HTML 502/503 page from the hosting proxy
      }
      if (!res.ok) {
        const err = data?.error ?? {};
        throw new ApiError(
          err.message ?? data?.detail ?? `Request failed (${res.status})`,
          err.code ?? `HTTP_${res.status}`,
          err.retryable ?? res.status >= 500,
          res.status,
        );
      }
      return data as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if ((e as Error).name === "AbortError")
        throw new ApiError("The field system took too long to respond. Please retry.", "TIMEOUT", true);
      throw new ApiError("Cannot reach the TERRAFORM backend. Is it running on " + API_BASE_URL + "?", "NETWORK", true);
    } finally {
      clearTimeout(timer);
    }
  };

  // Known asleep → don't fire into the void, wait for it first.
  if (backendStatus.online === false && !(await waitForBackend())) {
    throw new ApiError("The server is still waking up. Please try again in a moment.", "NETWORK", true);
  }
  try {
    const out = await once();
    if (backendStatus.online !== true) setBackendStatus({ online: true });
    return out;
  } catch (e) {
    if (!isTransient(e)) throw e;
    // Sleeping / restarting server: flip the status (the gate appears), wait for it, then retry ONCE.
    setBackendStatus({ online: false });
    const awake = await waitForBackend();
    if (!awake) throw e;
    return await once();
  }
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  /** Probe the backend (never gated, 10 s timeout). Publishes online/offline to the store via subscribeBackend. */
  health: () => checkBackendOnce(),

  createSession: () => request<SessionState>("/api/sessions", { method: "POST", body: json({}) }),
  getSession: (id: string) => request<SessionState>(`/api/sessions/${id}`),
  updateSession: (id: string, patch: Partial<SessionState>) =>
    request<SessionState>(`/api/sessions/${id}`, { method: "PUT", body: json(patch) }),

  analyze: (observation: ObservationInput, session_id: string | null) =>
    request<AnalysisResponse>("/api/observations/analyze", {
      method: "POST",
      body: json({ session_id, scenario_id: SCENARIO_ID, observation }),
    }, 45000),

  generatePlan: (args: {
    observation: ObservationInput;
    session_id: string | null;
    selected_crop_id?: string | null;
    completed_tasks?: string[];
    accepted_risks?: string[];
    gate_results?: Record<string, "pass" | "fail">;
  }) =>
    request<PlanResponse>("/api/plans/generate", {
      method: "POST",
      body: json({ scenario_id: SCENARIO_ID, ...args }),
    }, 45000),

  getPlan: (planId: string) => request<PlanResponse>(`/api/plans/${planId}`),

  updateProgress: (
    planId: string,
    body: {
      task_id?: string;
      completed?: boolean;
      accept_risk_gate_id?: string;
      selected_crop_id?: string | null;
      gate_result?: { gate_id: string; result: "pass" | "fail" | null };
    },
  ) => request<ProgressResponse>(`/api/plans/${planId}/progress`, { method: "PATCH", body: json(body) }),

  uploadPhoto: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<PhotoUploadResponse>("/api/uploads/land-photo", { method: "POST", body: fd }, 45000);
  },
  analyzePhoto: (photoId: string) =>
    request<PhotoAnalyzeResponse>(`/api/uploads/${photoId}/analyze`, { method: "POST", body: JSON.stringify({}) }, 45000),
  photoUrl: (photoId: string) => `${API_BASE_URL}/api/uploads/${photoId}`,

  getRecord: (kbId: string) => request<KbRecordResponse>(`/api/knowledge/records/${encodeURIComponent(kbId)}`),

  ask: (question: string, ctx: { session_id?: string | null; plan_id?: string | null; step_id?: string | null }) =>
    request<AskResponse>("/api/assistant/ask", { method: "POST", body: json({ question, ...ctx }) }, 45000),
};
