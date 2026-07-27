"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, RefreshCw, Settings2, Sparkles, Users } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { AdvisorReport, AiPillar, PillarKey } from "@/lib/portal-types";

const PILLAR_META: Record<PillarKey, { icon: typeof Lightbulb; blurb: string }> = {
  innovation: { icon: Lightbulb, blurb: "Is the idea itself advancing?" },
  operations: { icon: Settings2, blurb: "Is the team running well?" },
  delight: { icon: Users, blurb: "Are the people we serve better off?" },
};

/** Colour band for a 0-100 score. */
function tone(score: number): string {
  if (score >= 70) return "ok";
  if (score >= 45) return "warn";
  return "bad";
}

const EVIDENCE_LABELS: Record<string, string> = {
  meetings_total: "Meetings",
  meetings_last_28_days: "Meetings (28d)",
  meetings_with_minutes_recorded: "With minutes",
  actions_total: "Action items",
  actions_open: "Open",
  actions_overdue: "Overdue",
  actions_completed: "Completed",
  completion_rate_percent: "Closed %",
  weeks_reported_last_8: "Weeks reported (of 8)",
  measured_metrics: "Measured metrics",
};

function evidenceRows(evidence: AdvisorReport["evidence"]): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const group of Object.values(evidence ?? {})) {
    if (!group || typeof group !== "object") continue;
    for (const [key, value] of Object.entries(group)) {
      const label = EVIDENCE_LABELS[key];
      if (!label || typeof value !== "number") continue;
      rows.push({ label, value: String(value) });
    }
  }
  return rows;
}

type Props = {
  projectId: string;
};

export default function ProjectAdvisor({ projectId }: Props) {
  const [report, setReport] = useState<AdvisorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<PillarKey>("innovation");

  // Each review is a paid model call, and React runs mount effects twice in
  // development. Without this, opening the tab fires two completions.
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE_URL}/ai/projects/${projectId}/advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "The review could not be generated.");
      setReport(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [projectId]);

  // Fully automatic: the review runs on open, with no input to fill in first.
  useEffect(() => {
    run();
  }, [run]);

  const pillar: AiPillar | undefined = report?.pillars.find((p) => p.key === active);

  return (
    <div className="portal-advisor" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="table-card">
        <div className="portal-advisor-head">
          <div>
            <span className="portal-advisor-eyebrow">
              <Sparkles size={13} aria-hidden /> AI review
            </span>
            <h4>Innovation, excellence and delight</h4>
            <p>
              Reads this project&apos;s own record — weekly updates, meetings, action items, the results
              chain — and reports what to do next. Nothing to fill in.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={run} disabled={loading}>
            <RefreshCw size={15} aria-hidden className={loading ? "portal-pulse-spin" : undefined} />
            {loading ? "Reviewing..." : "Re-run review"}
          </button>
        </div>

        {loading && !report && (
          <div className="portal-advisor-loading">
            <span className="portal-advisor-shimmer" />
            Reading the project record and drafting a review...
          </div>
        )}

        {report && (
          <>
            <div className="portal-advisor-health">
              <div className={`portal-advisor-score tone-${tone(report.health_score)}`}>
                <strong>{report.health_score}</strong>
                <span>health</span>
              </div>
              <p>{report.health_summary}</p>
            </div>

            <ol className="portal-advisor-pillars">
              {report.pillars.map((p) => {
                const Icon = PILLAR_META[p.key]?.icon ?? Lightbulb;
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      className={`portal-advisor-pillar${p.key === active ? " is-active" : ""} tone-${tone(p.score)}`}
                      onClick={() => setActive(p.key)}
                      aria-current={p.key === active}
                    >
                      <span className="portal-advisor-pillar-top">
                        <Icon size={16} aria-hidden />
                        <strong>{p.score}</strong>
                      </span>
                      <strong className="portal-advisor-pillar-label">{p.label}</strong>
                      <small>{PILLAR_META[p.key]?.blurb}</small>
                      <span className="portal-advisor-meter">
                        <i style={{ width: `${p.score}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {pillar && (
        <section className="table-card">
          <div className="portal-advisor-stage-head">
            <div>
              <h4>{pillar.label}</h4>
              <p>{pillar.headline}</p>
            </div>
            <span className={`portal-advisor-chip tone-${tone(pillar.score)}`}>{pillar.score} / 100</span>
          </div>

          {pillar.findings.length > 0 && (
            <ul className="portal-advisor-findings">
              {pillar.findings.map((finding, i) => (
                <li key={i}>{finding}</li>
              ))}
            </ul>
          )}

          <div className="portal-advisor-recs">
            {pillar.recommendations.map((rec, i) => (
              <article key={i} className="portal-advisor-rec">
                <header>
                  <strong>{rec.title}</strong>
                  <span className="portal-advisor-tags">
                    <em className={`effort-${rec.effort}`}>{rec.effort} effort</em>
                    <em className={`impact-${rec.impact}`}>{rec.impact} impact</em>
                  </span>
                </header>
                {rec.why && <p>{rec.why}</p>}
                {rec.first_step && (
                  <p className="portal-advisor-step">
                    <strong>Start here:</strong> {rec.first_step}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {report && (
        <section className="table-card">
          <div className="portal-advisor-stage-head">
            <div>
              <h4>What this was based on</h4>
              <p>
                Counts are computed from your records and given to the model as fixed facts, so the review
                can never quote a number the dashboard disagrees with.
              </p>
            </div>
          </div>
          <div className="portal-advisor-evidence">
            {evidenceRows(report.evidence).map((row) => (
              <div key={row.label}>
                <strong>{row.value}</strong>
                <span>{row.label}</span>
              </div>
            ))}
          </div>
          <p className="portal-advisor-foot">
            Generated by {report.model} on{" "}
            {new Date(report.generated_at).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            . Treat it as a second opinion, not a decision.
          </p>
        </section>
      )}
    </div>
  );
}
