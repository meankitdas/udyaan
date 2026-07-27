"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Gauge, RefreshCw } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type {
  MaturityBenchmark,
  MaturityDimension,
  MaturityFramework,
  MaturityResult,
  MaturitySnapshot,
} from "@/lib/portal-types";

/** Readable names for the raw signal keys the API returns. */
const SIGNAL_LABELS: Record<string, string> = {
  projects: "Projects",
  with_full_brief: "With a full brief",
  with_deadline: "With a deadline",
  with_team_assigned: "With a team assigned",
  expected_weekly_reports: "Weekly reports expected",
  weekly_reports_filed: "Weekly reports filed",
  actions_total: "Action items",
  actions_closed: "Closed",
  actions_overdue: "Overdue",
  projects_with_approved_tool: "With a shared workspace",
  projects_with_meetings: "With meetings held",
  meetings: "Meetings",
  meetings_with_minutes: "With minutes recorded",
  impact_entries: "Impact records",
  entries_with_a_value: "With a measured value",
  entries_with_a_target: "With a target",
  projects_measuring: "Projects measuring",
  projects_with_a_results_chain: "With a results chain",
  projects_reaching_outcomes_or_impact: "Reaching outcomes or impact",
  average_chain_completeness: "Average chain completeness",
  users: "People",
  role_groups_covered: "Role groups covered",
  role_groups_expected: "Role groups expected",
  active_contributors: "Active contributors",
};

function toneFor(score?: number | null): string {
  if (score == null) return "none";
  if (score >= 60) return "ok";
  if (score >= 40) return "warn";
  return "bad";
}

export default function OrgMaturity() {
  const [framework, setFramework] = useState<MaturityFramework | null>(null);
  const [result, setResult] = useState<MaturityResult | null>(null);
  const [benchmark, setBenchmark] = useState<MaturityBenchmark | null>(null);
  const [snapshots, setSnapshots] = useState<MaturitySnapshot[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fw, res, bm, snaps] = await Promise.all([
        apiFetch(`${API_BASE_URL}/maturity/framework`, { headers: authHeaders() }),
        apiFetch(`${API_BASE_URL}/maturity/assessment`, { headers: authHeaders() }),
        apiFetch(`${API_BASE_URL}/maturity/benchmark`, { headers: authHeaders() }),
        apiFetch(`${API_BASE_URL}/maturity/snapshots`, { headers: authHeaders() }),
      ]);
      if (!res.ok) throw new Error("Could not calculate the maturity index.");
      setFramework(fw.ok ? await fw.json() : null);
      setResult(await res.json());
      setBenchmark(bm.ok ? await bm.json() : null);
      setSnapshots(snaps.ok ? await snaps.json() : []);
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const capture = async () => {
    setCapturing(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/maturity/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not capture a snapshot.");
      setNotice("Snapshot captured — future scores will be compared against it.");
      setError("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setCapturing(false);
    }
  };

  if (loading) return <div>Calculating maturity index...</div>;

  const openDimension: MaturityDimension | undefined = result?.dimensions.find((d) => d.key === active);
  const meta = (key: string) => framework?.dimensions.find((d) => d.key === key);
  const cohortFor = (key: string) => benchmark?.dimensions.find((d) => d.key === key)?.cohort_average;

  const previous = snapshots[0];
  const delta =
    result && previous ? Math.round((result.composite_score - previous.composite_score) * 10) / 10 : null;

  return (
    <div className="portal-dmi" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && !error && <div className="alert alert-success">{notice}</div>}

      <section className="table-card">
        <div className="portal-dmi-head">
          <div>
            <span className="portal-dmi-eyebrow">
              <Gauge size={13} aria-hidden /> {framework?.version ?? "Digital maturity"}
            </span>
            <h4>{framework?.name ?? "Digital Maturity Index"}</h4>
            <p>{framework?.summary}</p>
          </div>
          <div className="portal-dmi-actions">
            <button type="button" className="btn-secondary" onClick={load}>
              <RefreshCw size={14} aria-hidden /> Recalculate
            </button>
            <button type="button" className="btn-primary" onClick={capture} disabled={capturing}>
              <Camera size={15} aria-hidden /> {capturing ? "Capturing..." : "Capture snapshot"}
            </button>
          </div>
        </div>

        {result && (
          <div className="portal-dmi-score">
            <div className={`portal-dmi-dial tone-${toneFor(result.composite_score)}`}>
              <strong>{result.composite_score}</strong>
              <span>/ 100</span>
            </div>
            <div className="portal-dmi-score-body">
              <div className="portal-dmi-level">
                <span className="portal-dmi-level-num">Level {result.level}</span>
                <strong>{result.level_label}</strong>
                {delta !== null && (
                  <span className={`portal-dmi-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
                    {delta >= 0 ? "+" : ""}
                    {delta} since last snapshot
                  </span>
                )}
              </div>
              <p>{result.level_description}</p>
              <div className="portal-dmi-stat-row">
                <span>
                  Scored on <strong>{result.coverage}%</strong> of the framework
                </span>
                {benchmark?.cohort_average != null && (
                  <span>
                    Cohort average <strong>{benchmark.cohort_average}</strong> across{" "}
                    {benchmark.organizations} organisations
                  </span>
                )}
                {benchmark?.your_percentile != null && (
                  <span>
                    You rank in the <strong>{benchmark.your_percentile}th</strong> percentile
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* The ladder, so a score maps to a named stage rather than a bare number. */}
        {framework && result && (
          <ol className="portal-dmi-ladder">
            {framework.levels.map((lvl) => (
              <li key={lvl.level} className={lvl.level === result.level ? "is-current" : ""}>
                <strong>{lvl.label}</strong>
                <span>
                  {lvl.from}–{lvl.to}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="table-card">
        <div className="portal-dmi-head">
          <div>
            <h4>Dimensions</h4>
            <p>
              Each is scored from records already in the platform, so the number moves when practice
              changes — not when someone re-rates themselves. Select one to see its evidence.
            </p>
          </div>
        </div>

        <div className="portal-dmi-dims">
          {result?.dimensions.map((d) => {
            const cohort = cohortFor(d.key);
            return (
              <button
                key={d.key}
                type="button"
                className={`portal-dmi-dim tone-${toneFor(d.score)}${d.key === active ? " is-open" : ""}`}
                onClick={() => setActive(d.key === active ? null : d.key)}
                aria-expanded={d.key === active}
              >
                <span className="portal-dmi-dim-top">
                  <strong>{d.label}</strong>
                  <em>{d.applicable ? d.score : "n/a"}</em>
                </span>
                <span className="portal-dmi-meter">
                  <i style={{ width: `${d.applicable ? d.score ?? 0 : 0}%` }} />
                  {cohort != null && (
                    <b className="portal-dmi-cohort" style={{ left: `${cohort}%` }} title={`Cohort average ${cohort}`} />
                  )}
                </span>
                <span className="portal-dmi-dim-foot">
                  {d.applicable
                    ? `Level ${d.level} · ${d.level_label} · weight ${Math.round(d.weight * 100)}%`
                    : "Not enough evidence yet — excluded from the score"}
                </span>
              </button>
            );
          })}
        </div>

        {openDimension && (
          <div className="portal-dmi-detail">
            <h5>{openDimension.label}</h5>
            <p className="portal-dmi-question">{meta(openDimension.key)?.question}</p>
            <p className="portal-dmi-why">{meta(openDimension.key)?.why}</p>
            {Object.keys(openDimension.signals).length > 0 ? (
              <div className="portal-dmi-signals">
                {Object.entries(openDimension.signals).map(([key, value]) => (
                  <div key={key}>
                    <strong>{value}</strong>
                    <span>{SIGNAL_LABELS[key] ?? key.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="portal-dmi-empty">
                Nothing recorded against this dimension yet, so it is left out of the score rather than
                counted as zero.
              </p>
            )}
          </div>
        )}
      </section>

      {benchmark && benchmark.leaderboard.length > 1 && (
        <section className="table-card">
          <div className="portal-dmi-head">
            <div>
              <h4>Across organisations</h4>
              <p>
                Every organisation is scored by the same framework version, which is what makes these
                figures comparable.
              </p>
            </div>
          </div>
          <table className="portal-dmi-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Score</th>
                <th>Level</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.leaderboard.map((row) => (
                <tr
                  key={row.organization_id}
                  className={row.organization_id === result?.organization_id ? "is-you" : ""}
                >
                  <td>
                    {row.organization_name}
                    {row.organization_id === result?.organization_id && <em> — you</em>}
                  </td>
                  <td>{row.composite_score}</td>
                  <td>L{row.level}</td>
                  <td>{row.coverage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {snapshots.length > 0 && (
        <section className="table-card">
          <div className="portal-dmi-head">
            <div>
              <h4>Snapshot history</h4>
              <p>Captured baselines, so improvement can be shown rather than asserted.</p>
            </div>
          </div>
          <ol className="portal-dmi-history">
            {snapshots.map((s) => (
              <li key={s.id}>
                <strong>{s.composite_score}</strong>
                <span>Level {s.level}</span>
                <small>
                  {s.created_at
                    ? new Date(s.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : ""}{" "}
                  · {s.framework_version}
                </small>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
