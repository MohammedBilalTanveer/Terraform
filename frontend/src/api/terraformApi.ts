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

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
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
    throw new ApiError(
      "Cannot reach the TERRAFORM backend. Is it running on " + API_BASE_URL + "?",
      "NETWORK",
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  health: () => request<HealthResponse>("/api/health", {}, 5000),

  createSession: () => request<SessionState>("/api/sessions", { method: "POST", body: json({}) }),
  getSession: (id: string) => request<SessionState>(`/api/sessions/${id}`),
  updateSession: (id: string, patch: Partial<SessionState>) =>
    request<SessionState>(`/api/sessions/${id}`, { method: "PUT", body: json(patch) }),

  analyze: (observation: ObservationInput, session_id: string | null) =>
    request<AnalysisResponse>("/api/observations/analyze", {
      method: "POST",
      body: json({ session_id, scenario_id: SCENARIO_ID, observation }),
    }),

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
    }),

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
    return request<PhotoUploadResponse>("/api/uploads/land-photo", { method: "POST", body: fd }, 30000);
  },
  analyzePhoto: (photoId: string) =>
    request<PhotoAnalyzeResponse>(`/api/uploads/${photoId}/analyze`, { method: "POST", body: JSON.stringify({}) }, 30000),
  photoUrl: (photoId: string) => `${API_BASE_URL}/api/uploads/${photoId}`,

  getRecord: (kbId: string) => request<KbRecordResponse>(`/api/knowledge/records/${encodeURIComponent(kbId)}`),

  ask: (question: string, ctx: { session_id?: string | null; plan_id?: string | null; step_id?: string | null }) =>
    request<AskResponse>("/api/assistant/ask", { method: "POST", body: json({ question, ...ctx }) }),
};
