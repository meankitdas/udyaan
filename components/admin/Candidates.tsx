"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Evaluation, Question, ResponseFile, SurveyForm, SurveyResponse } from "@/lib/survey";
import { formatDuration } from "@/lib/survey";
import {
  calibrateResponses,
  deleteResponse,
  evaluateResponse,
  fetchCandidateFileUrl,
  fetchEngineStatus,
  listResponses,
} from "@/lib/api";
import type { EngineStatus } from "@/lib/api";
import { exportCandidatesToExcel } from "@/lib/export";

type VerdictFilter = "all" | Evaluation["verdict"] | "unscreened";

const VERDICT_LABEL: Record<Evaluation["verdict"], string> = {
  shortlist: "Shortlist",
  review: "Review",
  reject: "Reject",
};

const CRITERIA_LABELS: Record<string, { label: string; max: number }> = {
  farm_logic_accuracy: { label: "Farm logic", max: 30 },
  practical_problem_solving: { label: "Practical problem solving", max: 20 },
  strategic_decision_making: { label: "Strategic decisions", max: 15 },
  learning_mindset: { label: "Learning mindset", max: 15 },
  initiative_and_program_fit: { label: "Initiative & fit", max: 10 },
  engagement_and_completion: { label: "Engagement", max: 5 },
  timing_credibility: { label: "Timing credibility", max: 5 },
};

export function Candidates({ form }: { form: SurveyForm }) {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VerdictFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [screening, setScreening] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchEngineStatus().then(setEngine);
    listResponses().then((r) => {
      setResponses(r.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
      setLoading(false);
    });
  }, []);

  async function screen(response: SurveyResponse) {
    setScreening((s) => new Set(s).add(response.id));
    try {
      const evaluation = await evaluateResponse(form, response);
      setResponses((all) => all.map((r) => (r.id === response.id ? { ...r, evaluation } : r)));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setScreening((s) => {
        const next = new Set(s);
        next.delete(response.id);
        return next;
      });
    }
  }

  async function screenAll() {
    setBulkRunning(true);
    const needsCurrentRubric = responses.filter(
      (response) => !response.evaluation || Object.keys(response.evaluation.criteria ?? {}).length === 0,
    );
    setBulkProgress({ done: 0, total: needsCurrentRubric.length });
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < needsCurrentRubric.length) {
        const response = needsCurrentRubric[nextIndex];
        nextIndex += 1;
        await screen(response);
        setBulkProgress((progress) => ({ ...progress, done: progress.done + 1 }));
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(5, needsCurrentRubric.length) }, () => worker()),
    );
    try {
      const calibrated = await calibrateResponses();
      setResponses(calibrated.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Cohort ranking failed");
    } finally {
      setBulkRunning(false);
    }
  }

  async function remove(response: SurveyResponse) {
    setDeletingId(response.id);
    try {
      await deleteResponse(response.id);
      setResponses((all) => all.filter((r) => r.id !== response.id));
      setOpenId((id) => (id === response.id ? null : id));
      setConfirmDeleteId(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete this candidate");
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * Opens the CV in a new tab. The link is minted per click and expires, so it
   * cannot be stored in the markup — which is why this is a button, not an href.
   */
  async function download(response: SurveyResponse, questionId: string) {
    const key = `${response.id}:${questionId}`;
    setDownloading(key);
    try {
      const url = await fetchCandidateFileUrl(response.id, questionId);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not fetch the file");
    } finally {
      setDownloading(null);
    }
  }

  async function exportToExcel() {
    setExporting(true);
    try {
      // Exports what the admin is currently looking at, so a filtered view
      // ("shortlist only") exports that shortlist rather than the whole cohort.
      await exportCandidatesToExcel(form, filtered);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const pendingCount = responses.filter(
    (response) => !response.evaluation || Object.keys(response.evaluation.criteria ?? {}).length === 0,
  ).length;
  const filtered = useMemo(() => {
    let list = responses;
    if (filter === "unscreened") list = list.filter((r) => !r.evaluation);
    else if (filter !== "all") list = list.filter((r) => r.evaluation?.verdict === filter);
    return [...list].sort((a, b) => (b.evaluation?.score ?? -1) - (a.evaluation?.score ?? -1));
  }, [responses, filter]);

  const counts = useMemo(() => {
    const c = { all: responses.length, shortlist: 0, review: 0, reject: 0, unscreened: 0 };
    for (const r of responses) {
      if (!r.evaluation) c.unscreened += 1;
      else c[r.evaluation.verdict] += 1;
    }
    return c;
  }, [responses]);

  if (loading) return <p className="ad-loading">Loading candidates{"\u2026"}</p>;

  return (
    <div className="cd-wrap">
      <div className="cd-toolbar">
        <div className="cd-filters" role="tablist">
          {(["all", "shortlist", "review", "reject", "unscreened"] as VerdictFilter[]).map((f) => (
            <button
              key={f}
              className={`cd-filter${filter === f ? " cd-filter-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "unscreened" ? "Unscreened" : VERDICT_LABEL[f]}
              <em>{counts[f]}</em>
            </button>
          ))}
        </div>
        <div className="cd-toolbar-right">
          <span className="cd-cohort-policy" title="Bulk screening ranks eligible candidates and targets the top 15%, within the approved 10–20% range.">
            Cohort target: top 15%
          </span>
          <span className="cd-engine" title="Screening engine (from backend /health) and storage backend">
            Engine: {engine ? `${engine.screening} \u00b7 ${engine.storage}` : "\u2026"}
          </span>
          <motion.button
            className="sv-btn cd-export"
            onClick={exportToExcel}
            disabled={exporting || filtered.length === 0}
            whileTap={{ scale: 0.97 }}
            title={
              filter === "all"
                ? "Download every candidate as an Excel workbook"
                : `Download the ${filtered.length} candidate(s) in this filter as an Excel workbook`
            }
          >
            {exporting ? "Building sheet\u2026" : `Export Excel (${filtered.length})`}
          </motion.button>
          <motion.button
            className="sv-btn sv-btn-primary cd-screen-all"
            onClick={screenAll}
            disabled={bulkRunning || responses.length === 0}
            whileTap={{ scale: 0.97 }}
          >
            {bulkRunning
              ? bulkProgress.total
                ? `Screening ${bulkProgress.done}/${bulkProgress.total}\u2026`
                : "Ranking cohort\u2026"
              : pendingCount
                ? `Screen ${pendingCount} & rank cohort`
                : "Re-rank cohort"}
          </motion.button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cd-empty">
          <p>No candidates {filter === "all" ? "yet" : "in this bucket"}.</p>
          <p className="cd-empty-hint">Responses appear here as soon as students submit the survey.</p>
        </div>
      ) : (
        <ul className="cd-list">
          <AnimatePresence initial={false}>
            {filtered.map((r) => {
              const name = str(r.answers["full_name"]) || "Anonymous";
              const email = str(r.answers["email"]);
              const dept = str(r.answers["department"]);
              const campus = str(r.answers["campus"]);
              const isOpen = openId === r.id;
              const busy = screening.has(r.id);
              const cvEntry = firstFile(r);
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="cd-card"
                >
                  <div className="cd-card-top">
                    <button className="cd-card-head" onClick={() => setOpenId(isOpen ? null : r.id)}>
                      <div className="cd-id">
                        <strong>{name}</strong>
                        <span>{[email, dept, campus].filter(Boolean).join(" \u00b7 ")}</span>
                      </div>
                      <div className="cd-meta">
                        {typeof r.score === "number" && r.maxScore ? (
                          <span className="cd-chip">Quiz {r.score}/{r.maxScore}</span>
                        ) : null}
                        <span className="cd-chip">{formatDuration(r.totalMs)}</span>
                        {r.evaluation ? (
                          <span className={`cd-verdict cd-verdict-${r.evaluation.verdict}`}>
                            {VERDICT_LABEL[r.evaluation.verdict]} {"\u00b7"} {r.evaluation.score}
                          </span>
                        ) : (
                          <span className="cd-chip cd-chip-muted">Unscreened</span>
                        )}
                        <span className="cd-caret" aria-hidden>{isOpen ? "\u25b4" : "\u25be"}</span>
                      </div>
                    </button>

                    <div className="cd-card-actions">
                      {cvEntry && (
                        <button
                          className="cd-action cd-action-cv"
                          onClick={() => download(r, cvEntry[0])}
                          disabled={downloading === `${r.id}:${cvEntry[0]}`}
                          title={`Download ${cvEntry[1].name}`}
                        >
                          <DownloadIcon />
                          {downloading === `${r.id}:${cvEntry[0]}` ? "Opening\u2026" : "CV"}
                        </button>
                      )}
                      {confirmDeleteId === r.id ? (
                        <span className="cd-confirm">
                          <button
                            className="cd-action cd-action-danger"
                            onClick={() => remove(r)}
                            disabled={deletingId === r.id}
                          >
                            {deletingId === r.id ? "Deleting\u2026" : "Confirm"}
                          </button>
                          <button className="cd-action" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          className="cd-action cd-action-delete"
                          onClick={() => setConfirmDeleteId(r.id)}
                          title={`Delete ${name}`}
                          aria-label={`Delete ${name}`}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className="cd-detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                      >
                        <div className="cd-detail-grid">
                          <div className="cd-answers">
                            <h3>Answers</h3>
                            {form.sections.filter((s) => s.questions.length > 0).map((s) => (
                              <div key={s.id} className="cd-answer-group">
                                <h4>{s.title}</h4>
                                {s.questions.map((q) => {
                                  const timing = r.timings.find((t) => t.questionId === q.id);
                                  const v = r.answers[q.id];
                                  const correct = q.correctOption != null && v === q.correctOption;
                                  const wrong = q.correctOption != null && v != null && v !== q.correctOption;
                                  if (q.type === "file") {
                                    return (
                                      <FileAnswerRow
                                        key={q.id}
                                        question={q}
                                        fileName={str(v)}
                                        stored={r.files?.[q.id]}
                                        busy={downloading === `${r.id}:${q.id}`}
                                        onDownload={() => download(r, q.id)}
                                      />
                                    );
                                  }
                                  return (
                                    <div key={q.id} className="cd-answer-row">
                                      <p className="cd-q">{q.label}</p>
                                      <p className={`cd-a${correct ? " cd-a-correct" : ""}${wrong ? " cd-a-wrong" : ""}`}>
                                        {Array.isArray(v) ? v.join(", ") : v || "\u2014"}
                                        {timing && (
                                          <span className="cd-timing"> {formatDuration(timing.activeMs)} {"\u00b7"} {timing.changes} change{timing.changes === 1 ? "" : "s"}</span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>

                          <div className="cd-eval">
                            <h3>AI screening</h3>
                            {r.evaluation ? (
                              <div className={`cd-eval-card cd-eval-${r.evaluation.verdict}`}>
                                <p className="cd-eval-verdict">
                                  {VERDICT_LABEL[r.evaluation.verdict]} {"\u00b7"} score {r.evaluation.score}/100
                                </p>
                                {r.evaluation.cohortRank && r.evaluation.cohortSize && (
                                  <p className="cd-cohort-rank">
                                    Cohort rank #{r.evaluation.cohortRank} of {r.evaluation.cohortSize}
                                    {r.evaluation.cohortPercentile != null && ` \u00b7 top ${r.evaluation.cohortPercentile}%`}
                                  </p>
                                )}
                                {Object.keys(r.evaluation.criteria ?? {}).length > 0 && (
                                  <div className="cd-criteria" aria-label="Assessment criteria scores">
                                    {Object.entries(r.evaluation.criteria ?? {}).map(([key, value]) => {
                                      const meta = CRITERIA_LABELS[key] ?? { label: key.replaceAll("_", " "), max: 100 };
                                      return (
                                        <div key={key} className="cd-criterion">
                                          <span>{meta.label}</span>
                                          <strong>{value}/{meta.max}</strong>
                                          <i aria-hidden><b style={{ width: `${Math.min(100, value / meta.max * 100)}%` }} /></i>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="cd-eval-reasoning">{r.evaluation.reasoning}</p>
                                {r.evaluation.strengths.length > 0 && (
                                  <>
                                    <h5>Strengths</h5>
                                    <ul>{r.evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                  </>
                                )}
                                {r.evaluation.concerns.length > 0 && (
                                  <>
                                    <h5>Concerns</h5>
                                    <ul>{r.evaluation.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                  </>
                                )}
                                <h5>Timing analysis</h5>
                                <p className="cd-eval-timing">{r.evaluation.timingAnalysis}</p>
                                <p className="cd-eval-model">
                                  {r.evaluation.model} {"\u00b7"} {new Date(r.evaluation.evaluatedAt).toLocaleString()}
                                </p>
                              </div>
                            ) : (
                              <p className="cd-eval-none">Not screened yet.</p>
                            )}
                            <motion.button
                              className="sv-btn sv-btn-primary cd-screen-one"
                              onClick={() => screen(r)}
                              disabled={busy}
                              whileTap={{ scale: 0.97 }}
                            >
                              {busy ? "Screening\u2026" : r.evaluation ? "Re-run screening" : "Run AI screening"}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function str(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}

/** The first stored attachment, as a [questionId, file] pair, or null. */
function firstFile(response: SurveyResponse): [string, ResponseFile] | null {
  const entries = Object.entries(response.files ?? {});
  return entries.length ? entries[0] : null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * A file answer needs its own row: the value is just a filename, which used to
 * leave the reviewer with nothing to open. When the bytes were stored this
 * offers the download; when they were not, it says so rather than pretending the
 * filename is the document.
 */
function FileAnswerRow({
  question,
  fileName,
  stored,
  busy,
  onDownload,
}: {
  question: Question;
  fileName: string;
  stored?: ResponseFile;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="cd-answer-row">
      <p className="cd-q">{question.label}</p>
      {stored ? (
        <p className="cd-a cd-a-file">
          <button className="cd-file-btn" onClick={onDownload} disabled={busy}>
            <DownloadIcon />
            {busy ? "Opening\u2026" : stored.name}
          </button>
          {stored.size > 0 && <span className="cd-timing"> {formatBytes(stored.size)}</span>}
        </p>
      ) : fileName ? (
        <p className="cd-a cd-a-file">
          {fileName}
          <span className="cd-timing"> {"\u2014"} not stored; submitted before uploads were enabled</span>
        </p>
      ) : (
        <p className="cd-a">{"\u2014"}</p>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6 7v13h12V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
