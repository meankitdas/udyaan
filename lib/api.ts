"use client";

import type { Evaluation, ResponseFile, SurveyForm, SurveyResponse } from "./survey";
import { computeQuizScore } from "./survey";
import { DEFAULT_FORM, withCanonicalReflect } from "./default-form";

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
    throw new ApiError(res.status, describe(detail) || res.statusText);
  }
  // A 204 (used by DELETE) has no body to parse.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * FastAPI wraps every error in `{"detail": ...}`. Surfacing the raw body puts
 * JSON in front of the user, so unwrap it and fall back to the raw text when the
 * body is not the shape we expect.
 */
function describe(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  } catch {
    /* not JSON — use the raw text */
  }
  return body;
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
      return withCanonicalReflect(await request<SurveyForm>("/forms/active"));
    } catch {
      return withCanonicalReflect(readLocal(FORM_KEY, DEFAULT_FORM));
    }
  }
  return withCanonicalReflect(readLocal(FORM_KEY, DEFAULT_FORM));
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

export async function deleteResponse(responseId: string): Promise<void> {
  if (hasBackend) {
    try {
      await request<void>(`/responses/${responseId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch (err) {
      // A candidate that is already gone from the server is still a success
      // from the admin's point of view; anything else is a real failure.
      if (!(err instanceof ApiError) || err.status !== 404) throw err;
    }
  }
  // Mirror the removal locally so the demo/offline cache cannot resurrect a
  // candidate the admin has already deleted.
  const all = readLocal<SurveyResponse[]>(RESPONSES_KEY, []);
  writeLocal(RESPONSES_KEY, all.filter((r) => r.id !== responseId));
}

// ---------- Candidate file uploads ----------

export type UploadTicket = {
  uploadUrl: string;
  fields: Record<string, string>;
  objectKey: string;
  fileName: string;
  contentType: string;
  maxBytes: number;
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Browsers disagree on the MIME type of .doc/.docx (and give an empty string
 * often enough), but the backend signs the declared type into the upload policy,
 * so a wrong guess makes the upload fail at S3. The extension is the more
 * reliable signal here.
 */
function resolveContentType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? file.type ?? "";
}

/**
 * Upload a candidate file straight to object storage and return the reference
 * that gets stored on the response.
 *
 * The bytes never pass through the API: it only mints a presigned POST that
 * pins the key, the content type and the size limit.
 */
export async function uploadCandidateFile(file: File): Promise<ResponseFile> {
  if (!hasBackend) {
    throw new Error("File uploads need the Udyaan API. Your other answers still save normally.");
  }
  const contentType = resolveContentType(file);
  let ticket: UploadTicket;
  try {
    ticket = await request<UploadTicket>("/uploads/cv", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, contentType, size: file.size }),
    });
  } catch (err) {
    // A deployment without a bucket is not the candidate's problem, and the CV
    // is optional, so say what actually happens rather than showing a 503.
    if (err instanceof ApiError && err.status === 503) {
      throw new Error("File uploads are unavailable right now. Your other answers still save.");
    }
    throw err;
  }

  const body = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) body.append(key, value);
  // The file must be appended last: S3 ignores anything after it in the form.
  body.append("file", file);

  const res = await fetch(ticket.uploadUrl, { method: "POST", body });
  if (!res.ok) {
    throw new Error("Upload failed. Check your connection and try again.");
  }
  return {
    name: ticket.fileName,
    size: file.size,
    contentType: ticket.contentType,
    objectKey: ticket.objectKey,
    uploadedAt: new Date().toISOString(),
  };
}

export async function uploadsEnabled(): Promise<boolean> {
  if (!hasBackend) return false;
  try {
    const status = await request<{ enabled: boolean }>("/uploads/status");
    return status.enabled;
  } catch {
    return false;
  }
}

/**
 * Mint a short-lived download link for a candidate's uploaded file.
 * Minted per click rather than stored, so the objects stay private.
 */
export async function fetchCandidateFileUrl(responseId: string, questionId: string): Promise<string> {
  if (!hasBackend) {
    throw new Error("Downloads need the Udyaan API.");
  }
  const ticket = await request<{ url: string; fileName: string; expiresIn: number }>(
    `/responses/${responseId}/files/${questionId}`,
    { headers: authHeaders() },
  );
  return ticket.url;
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

  // Per-question read-time floor: could the student have actually read it?
  const questionById = new Map(form.sections.flatMap((section) => section.questions).map((q) => [q.id, q]));
  const minReadSeconds = (q: { label: string; options?: string[]; image?: string }) => {
    let words = q.label.split(/\s+/).length;
    for (const option of q.options ?? []) words += option.split(/\s+/).length;
    return Math.max(1.5, words / 5 + 0.8 + (q.image ? 1.2 : 0));
  };
  const timedAnswered = response.timings.filter((t) => questionById.has(t.questionId) && response.answers[t.questionId]);
  const unreadCount = timedAnswered.filter((t) => t.activeMs / 1000 < minReadSeconds(questionById.get(t.questionId)!) * 0.6).length;
  const unreadRate = timedAnswered.length ? unreadCount / timedAnswered.length : 0;
  const dwells = timedAnswered.map((t) => t.activeMs / 1000);
  const dwellMean = dwells.length ? dwells.reduce((a, b) => a + b, 0) / dwells.length : 0;
  const dwellSpread = dwells.length ? Math.sqrt(dwells.reduce((a, d) => a + (d - dwellMean) ** 2, 0) / dwells.length) : 0;
  const uniformPace = dwells.length >= 5 && dwellMean < 6 && dwellSpread < 1;
  const rapidFill = unreadRate >= 0.5 || (uniformPace && unreadRate >= 0.3);
  const carefulReader = timedAnswered.length > 0 && unreadRate <= 0.15 && !uniformPace;
  const answer = (id: string) => {
    const value = response.answers[id];
    return typeof value === "string" ? value : value?.join(" ") ?? "";
  };
  const sectionAccuracy = (id: string) => {
    const scored = form.sections.find((section) => section.id === id)?.questions.filter((q) => q.correctOption) ?? [];
    return scored.length ? scored.filter((q) => response.answers[q.id] === q.correctOption).length / scored.length : 0;
  };
  // Mirrors the backend weights in app/rag/evaluator.py; keep the two in step.
  const resourcePoints: Record<string, number> = {
    "Talk to the people who'd use it first": 6,
    "Use my own direct experience as the first signal": 5.5,
    "Build the smallest possible version and test it": 5,
    "Look for existing evidence first": 4.5,
  };
  const improvePoints: Record<string, number> = {
    "I paused, reconsidered, and came back differently": 5,
    "I let it end, and that was the right call": 5,
    "I adjusted the approach and kept going": 4.5,
    "I'm still in it, unresolved": 4,
  };
  const ideaPoints: Record<string, number> = {
    "A tested idea with early signal": 6,
    "A working prototype, even if rough": 5.5,
    "Evidence I was wrong, and a better direction because of it": 5,
    "Clarity on the problem, even without a product yet": 4.5,
  };
  /** Average across selected options, so ticking every box beats nothing. */
  const multiPoints = (id: string, points: Record<string, number>, fallback: number) => {
    const value = response.answers[id];
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    if (selected.length === 0) return 0;
    return selected.reduce((total, option) => total + (points[option] ?? fallback), 0) / selected.length;
  };
  const required = form.sections.flatMap((section) => section.questions).filter((q) => q.required);
  const completionRate = required.length
    ? required.filter((q) => response.answers[q.id]).length / required.length
    : 1;
  const criteria = {
    farm_logic_accuracy: Math.round(accuracy * 30),
    practical_problem_solving: Math.round(sectionAccuracy("level2") * 14 + multiPoints("reflect_resource", resourcePoints, 4)),
    strategic_decision_making: Math.round(sectionAccuracy("level3") * 10 + (answer("l3_q3") ? 5 : 0)),
    learning_mindset: Math.round((answer("reflect_interest") ? 4 : 0) + (answer("reflect_decision") ? 5 : 0) + multiPoints("reflect_improve", improvePoints, 3)),
    initiative_and_program_fit: Math.round((answer("reflect_interest") ? 4 : 0) + multiPoints("reflect_idea", ideaPoints, 3)),
    engagement_and_completion: Math.round(completionRate * 3 + (response.timings.some((timing) => timing.changes > 0) ? 2 : response.timings.length ? 1.5 : 1)),
    timing_credibility: response.timings.length === 0 ? 3 : rapidFill ? 0 : rushed || unreadRate >= 0.3 ? 1 : carefulReader && deliberate ? 5 : deliberate ? 4 : 3,
  };
  const composite = Object.values(criteria).reduce((total, value) => total + value, 0);
  let verdict: Evaluation["verdict"] = composite >= 68 ? "shortlist" : composite >= 48 ? "review" : "reject";
  if ((rushed || rapidFill) && verdict === "shortlist") verdict = "review";

  const strengths: string[] = [];
  const concerns: string[] = [];
  if (accuracy >= 0.75) strengths.push(`Strong farm-logic accuracy (${score}/${maxScore}).`);
  else if (accuracy >= 0.5) strengths.push(`Moderate quiz accuracy (${score}/${maxScore}).`);
  else concerns.push(`Low quiz accuracy (${score}/${maxScore}).`);
  if (criteria.practical_problem_solving >= 15) strengths.push("Strong practical resourcefulness.");
  if (criteria.learning_mindset >= 12) strengths.push("Constructive learning and self-correction mindset.");
  if (rapidFill) concerns.push(`Rapid-fill pattern: ${unreadCount}/${timedAnswered.length} answers arrived faster than the question could be read${uniformPace ? ", with near-uniform pacing" : ""}.`);
  else if (unreadRate >= 0.3) concerns.push(`${unreadCount}/${timedAnswered.length} answers were faster than the minimum read time.`);
  if (rushed) concerns.push("Answered quiz questions unusually fast; possible guessing.");
  if (carefulReader) strengths.push(`Read ${Math.round((1 - unreadRate) * 100)}% of questions at a humanly plausible pace.`);
  else if (deliberate) strengths.push("Healthy per-question pacing suggests genuine reasoning.");

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
    timingAnalysis:
      `Read-time check: ${unreadCount}/${timedAnswered.length} answers below the per-question minimum read time. ` +
      (rapidFill
        ? "Rapid-fill pattern detected \u2014 answers arrived faster than the questions could be read."
        : rushed
          ? "Average quiz dwell under 3s; a strong result should receive human review."
          : carefulReader
            ? "Pacing is consistent with genuinely reading each question."
            : deliberate
              ? "Pacing sits in the broad credible band for short choice questions."
              : "Pacing is acceptable; no strong timing signal either way."),
    evaluatedAt: new Date().toISOString(),
    model: "local-heuristic",
  };
}
