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

export async function calibrateResponses(): Promise<SurveyResponse[]> {
  if (hasBackend) {
    return request<SurveyResponse[]>("/screening/calibrate", {
      method: "POST",
      headers: authHeaders(),
    });
  }
  const responses = readLocal<SurveyResponse[]>(RESPONSES_KEY, []);
  const ranked = responses
    .filter((response) => response.evaluation)
    .sort((a, b) => (b.evaluation?.score ?? 0) - (a.evaluation?.score ?? 0));
  const size = ranked.length;
  const target = size ? Math.max(1, Math.round(size * 0.15)) : 0;
  const eligible = ranked.filter((response) =>
    (response.evaluation?.score ?? 0) >= 48 && (response.evaluation?.criteria?.timing_credibility ?? 3) > 1
  );
  const shortlisted = new Set(eligible.slice(0, target).map((response) => response.id));
  ranked.forEach((response, index) => {
    if (!response.evaluation) return;
    response.evaluation.cohortRank = index + 1;
    response.evaluation.cohortSize = size;
    response.evaluation.cohortPercentile = Number((((index + 1) / size) * 100).toFixed(1));
    response.evaluation.verdict = shortlisted.has(response.id)
      ? "shortlist"
      : response.evaluation.score >= 48
        ? "review"
        : "reject";
  });
  writeLocal(RESPONSES_KEY, responses);
  return responses;
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
 * Mirrors the backend seven-parameter rubric for demo/offline mode.
 */
function heuristicEvaluation(form: SurveyForm, response: SurveyResponse): Evaluation {
  const { score, maxScore } = computeQuizScore(form, response.answers);
  const accuracy = maxScore > 0 ? score / maxScore : 0;

  const quizTimings = response.timings.filter((t) => /^l\d/.test(t.questionId));
  const avgQuizMs = quizTimings.length
    ? quizTimings.reduce((a, t) => a + t.activeMs, 0) / quizTimings.length
    : 0;
  const rushed = avgQuizMs > 0 && avgQuizMs < 3000;
  const deliberate = avgQuizMs >= 4000 && avgQuizMs <= 120000;
  const answer = (id: string) => {
    const value = response.answers[id];
    return typeof value === "string" ? value : value?.join(" ") ?? "";
  };
  const sectionAccuracy = (id: string) => {
    const scored = form.sections.find((section) => section.id === id)?.questions.filter((q) => q.correctOption) ?? [];
    return scored.length ? scored.filter((q) => response.answers[q.id] === q.correctOption).length / scored.length : 0;
  };
  const resourcePoints: Record<string, number> = {
    "Working with scarcity": 4.5,
    "Substituting what was available": 5,
    "Leveraging people, not just materials": 5.5,
    "Constraint leading to a better outcome": 6,
  };
  const improvePoints: Record<string, number> = {
    "Better preparation": 3,
    "Slower, clearer problem framing": 5,
    "More self-questioning": 5,
    "Better use of available resources": 5,
  };
  const ideaPoints: Record<string, number> = {
    "A clear idea": 6,
    "A direction, not a finished idea": 5,
    "An early, unvalidated idea": 4,
    "Honest, without an idea yet": 3,
  };
  const required = form.sections.flatMap((section) => section.questions).filter((q) => q.required);
  const completionRate = required.length
    ? required.filter((q) => response.answers[q.id]).length / required.length
    : 1;
  const criteria = {
    farm_logic_accuracy: Math.round(accuracy * 30),
    practical_problem_solving: Math.round(sectionAccuracy("level2") * 14 + (answer("reflect_resource") ? resourcePoints[answer("reflect_resource")] ?? 4 : 0)),
    strategic_decision_making: Math.round(sectionAccuracy("level3") * 10 + (answer("l3_q3") ? 5 : 0)),
    learning_mindset: Math.round((answer("reflect_interest") ? 4 : 0) + (answer("reflect_decision") ? 5 : 0) + (answer("reflect_improve") ? improvePoints[answer("reflect_improve")] ?? 3 : 0)),
    initiative_and_program_fit: Math.round((answer("reflect_interest") ? 4 : 0) + (answer("reflect_idea") ? ideaPoints[answer("reflect_idea")] ?? 3 : 0)),
    engagement_and_completion: Math.round(completionRate * 3 + (response.timings.some((timing) => timing.changes > 0) ? 2 : response.timings.length ? 1.5 : 1)),
    timing_credibility: response.timings.length === 0 ? 3 : rushed ? 1 : deliberate ? 5 : 4,
  };
  const composite = Object.values(criteria).reduce((total, value) => total + value, 0);
  let verdict: Evaluation["verdict"] = composite >= 68 ? "shortlist" : composite >= 48 ? "review" : "reject";
  if (rushed && verdict === "shortlist") verdict = "review";

  const strengths: string[] = [];
  const concerns: string[] = [];
  if (accuracy >= 0.75) strengths.push(`Strong farm-logic accuracy (${score}/${maxScore}).`);
  else if (accuracy >= 0.5) strengths.push(`Moderate quiz accuracy (${score}/${maxScore}).`);
  else concerns.push(`Low quiz accuracy (${score}/${maxScore}).`);
  if (criteria.practical_problem_solving >= 15) strengths.push("Strong practical resourcefulness.");
  if (criteria.learning_mindset >= 12) strengths.push("Constructive learning and self-correction mindset.");
  if (rushed) concerns.push("Answered quiz questions unusually fast; possible guessing.");
  if (deliberate) strengths.push("Healthy per-question pacing suggests genuine reasoning.");

  return {
    verdict,
    score: composite,
    criteria,
    reasoning:
      `Offline multi-factor screen: farm logic ${criteria.farm_logic_accuracy}/30, practical problem solving ` +
      `${criteria.practical_problem_solving}/20, strategic decisions ${criteria.strategic_decision_making}/15, ` +
      `learning mindset ${criteria.learning_mindset}/15, initiative ${criteria.initiative_and_program_fit}/10, ` +
      `engagement ${criteria.engagement_and_completion}/5, timing ${criteria.timing_credibility}/5.`,
    strengths,
    concerns,
    timingAnalysis: rushed
      ? "Average quiz dwell under 3s; a strong result should receive human review."
      : deliberate
        ? "Pacing sits in the broad credible band for short choice questions."
        : "Pacing is acceptable; no strong timing signal either way.",
    evaluatedAt: new Date().toISOString(),
    model: "local-heuristic",
  };
}
