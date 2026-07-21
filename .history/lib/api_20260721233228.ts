"use client";

import type { Evaluation, SurveyForm, SurveyResponse } from "./survey";
import { computeQuizScore } from "./survey";
import { DEFAULT_FORM } from "./default-form";

const API_BASE = (process.env.NEXT_PUBLIC_UDYAAN_API ?? "").replace(/\/$/, "");
const FORM_KEY = "udyaan_form_v1";
const RESPONSES_KEY = "udyaan_responses_v1";
const TOKEN_KEY = "udyaan_admin_token";

export const hasBackend = API_BASE.length > 0;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401) {
      // Session expired or token invalid — clear it and let the UI return to login.
      setToken(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("udyaan:unauthorized"));
      }
      throw new Error("Your admin session has expired. Please sign in again.");
    }
    throw new Error(`API ${res.status}: ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Auth ----------

export async function adminLogin(email: string, password: string): Promise<string> {
  if (hasBackend) {
    const data = await request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    return data.access_token;
  }
  // Demo fallback: local-only session.
  if (email === "admin@udyaan.edu" && password === "udyaan-admin") {
    const token = `demo.${btoa(email)}.${Date.now()}`;
    setToken(token);
    return token;
  }
  throw new Error("Invalid credentials. Demo login: admin@udyaan.edu / udyaan-admin");
}

// ---------- Form ----------

export async function fetchForm(): Promise<SurveyForm> {
  if (hasBackend) {
    try {
      return await request<SurveyForm>("/forms/active");
    } catch {
      return readLocal(FORM_KEY, DEFAULT_FORM);
    }
  }
  return readLocal(FORM_KEY, DEFAULT_FORM);
}

export async function saveForm(form: SurveyForm): Promise<SurveyForm> {
  const next = { ...form, updatedAt: new Date().toISOString() };
  if (hasBackend) {
    await request<SurveyForm>(`/forms/${form.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(next),
    });
  }
  writeLocal(FORM_KEY, next);
  return next;
}

export function resetFormToDefault(): SurveyForm {
  writeLocal(FORM_KEY, DEFAULT_FORM);
  return DEFAULT_FORM;
}

// ---------- Responses ----------

export async function submitResponse(response: SurveyResponse): Promise<SurveyResponse> {
  if (hasBackend) {
    try {
      return await request<SurveyResponse>("/responses", {
        method: "POST",
        body: JSON.stringify(response),
      });
    } catch {
      // fall through to local so the candidate never loses a submission
    }
  }
  const all = readLocal<SurveyResponse[]>(RESPONSES_KEY, []);
  all.push(response);
  writeLocal(RESPONSES_KEY, all);
  return response;
}

export async function listResponses(): Promise<SurveyResponse[]> {
  if (hasBackend) {
    try {
      return await request<SurveyResponse[]>("/responses", { headers: authHeaders() });
    } catch {
      return readLocal<SurveyResponse[]>(RESPONSES_KEY, []);
    }
  }
  return readLocal<SurveyResponse[]>(RESPONSES_KEY, []);
}

// ---------- Screening ----------

export type EngineStatus = { storage: string; screening: string };

export async function fetchEngineStatus(): Promise<EngineStatus> {
  if (hasBackend) {
    try {
      const h = await request<{ storage: string; screening: string }>("/health");
      return { storage: h.storage, screening: h.screening };
    } catch {
      return { storage: "local", screening: "unreachable" };
    }
  }
  return { storage: "browser", screening: "heuristic" };
}

export async function evaluateResponse(form: SurveyForm, response: SurveyResponse): Promise<Evaluation> {
  if (hasBackend) {
    const data = await request<Evaluation>(`/screening/evaluate/${response.id}`, {
      method: "POST",
      headers: authHeaders(),
    });
    persistLocalEvaluation(response.id, data);
    return data;
  }
  const evaluation = heuristicEvaluation(form, response);
  persistLocalEvaluation(response.id, evaluation);
  return evaluation;
}

function persistLocalEvaluation(responseId: string, evaluation: Evaluation) {
  const all = readLocal<SurveyResponse[]>(RESPONSES_KEY, []);
  const idx = all.findIndex((r) => r.id === responseId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], evaluation };
    writeLocal(RESPONSES_KEY, all);
  }
}

/**
 * Local fallback when the Azure OpenAI backend is not configured.
 * Mirrors the backend rubric: quiz accuracy + timing credibility + reflection depth.
 */
function heuristicEvaluation(form: SurveyForm, response: SurveyResponse): Evaluation {
  const { score, maxScore } = computeQuizScore(form, response.answers);
  const accuracy = maxScore > 0 ? score / maxScore : 0;

  const quizTimings = response.timings.filter((t) => /^l\d/.test(t.questionId));
  const avgQuizMs = quizTimings.length
    ? quizTimings.reduce((a, t) => a + t.activeMs, 0) / quizTimings.length
    : 0;
  const rushed = avgQuizMs > 0 && avgQuizMs < 4000;
  const deliberate = avgQuizMs >= 8000 && avgQuizMs <= 90000;

  const reflections = Object.entries(response.answers)
    .filter(([k]) => k.startsWith("reflect_"))
    .map(([, v]) => (typeof v === "string" ? v : v.join(" ")));
  const reflectionDepth = reflections.reduce((a, t) => a + t.trim().split(/\s+/).filter(Boolean).length, 0);

  let composite = accuracy * 60;
  composite += Math.min(20, reflectionDepth / 6);
  if (deliberate) composite += 12;
  if (rushed) composite -= 15;
  composite = Math.max(0, Math.min(100, Math.round(composite)));

  const verdict: Evaluation["verdict"] = composite >= 70 ? "shortlist" : composite >= 45 ? "review" : "reject";

  const strengths: string[] = [];
  const concerns: string[] = [];
  if (accuracy >= 0.75) strengths.push(`Strong farm-logic accuracy (${score}/${maxScore}).`);
  else if (accuracy >= 0.5) strengths.push(`Moderate quiz accuracy (${score}/${maxScore}).`);
  else concerns.push(`Low quiz accuracy (${score}/${maxScore}).`);
  if (reflectionDepth >= 60) strengths.push("Detailed, thoughtful reflections.");
  else if (reflectionDepth < 25) concerns.push("Very brief reflections — motivation unclear.");
  if (rushed) concerns.push("Answered quiz questions unusually fast; possible guessing.");
  if (deliberate) strengths.push("Healthy per-question pacing suggests genuine reasoning.");

  return {
    verdict,
    score: composite,
    reasoning:
      `Heuristic screen (offline mode): accuracy ${(accuracy * 100).toFixed(0)}%, ` +
      `avg quiz dwell ${(avgQuizMs / 1000).toFixed(1)}s, reflection depth ${reflectionDepth} words. ` +
      `Connect the Azure OpenAI backend for full RAG-based evaluation.`,
    strengths,
    concerns,
    timingAnalysis: rushed
      ? "Average quiz dwell under 4s — pattern consistent with rapid guessing."
      : deliberate
        ? "Pacing sits in the credible 8–90s band per quiz question."
        : "Pacing is acceptable; no strong timing signal either way.",
    evaluatedAt: new Date().toISOString(),
    model: "local-heuristic",
  };
}
