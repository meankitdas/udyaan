"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import PortalSkeleton from "./PortalSkeleton";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { DigestRow, ImpactStageSummary, UpdateStatus, WeeklyDigest } from "@/lib/portal-types";

const STATUS_LABEL: Record<UpdateStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  blocked: "Blocked",
  completed: "Completed",
};

const STATUS_TONE: Record<UpdateStatus, string> = {
  on_track: "ok",
  at_risk: "warn",
  blocked: "bad",
  completed: "done",
};

const STAGE_LABEL: Record<string, string> = {
  inputs: "Inputs",
  process: "Process",
  outputs: "Outputs",
  outcomes: "Outcomes",
  impact: "Impact",
};

type SortKey = "title" | "status" | "completion" | "streak";
type Filter = "all" | "reported" | "missing" | "attention";

/** Monday of the week containing `base`, shifted by `offset` weeks. */
function mondayOf(base: Date, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d.toISOString().slice(0, 10);
}

function formatRange(start: string, end: string): string {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${new Date(start).toLocaleDateString(undefined, o)} – ${new Date(end).toLocaleDateString(undefined, o)}`;
}

export default function OpsControlCentre() {
  const router = useRouter();
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [chain, setChain] = useState<ImpactStageSummary[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "status", dir: "asc" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const week = mondayOf(new Date(), weekOffset);
      const [d, c] = await Promise.all([
        apiFetch(`${API_BASE_URL}/weekly-digest?week_of=${week}`, { headers: authHeaders() }),
        apiFetch(`${API_BASE_URL}/impact/overview`, { headers: authHeaders() }),
      ]);
      if (!d.ok) throw new Error("Could not load this week's digest.");
      setDigest(await d.json());
      setChain(c.ok ? await c.json() : []);
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    let list: DigestRow[] = digest?.rows ?? [];

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.title ?? "").toLowerCase().includes(q) ||
          r.project_id.toLowerCase().includes(q) ||
          (r.headline ?? "").toLowerCase().includes(q),
      );
    }
    if (filter === "reported") list = list.filter((r) => r.reported);
    if (filter === "missing") list = list.filter((r) => !r.reported);
    if (filter === "attention") {
      list = list.filter((r) => !r.reported || r.status === "at_risk" || r.status === "blocked");
    }

    // Default ordering surfaces what needs a decision: unreported first,
    // then blocked, then at risk.
    const severity = (r: DigestRow) =>
      !r.reported ? 0 : r.status === "blocked" ? 1 : r.status === "at_risk" ? 2 : 3;

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "title") cmp = (a.title ?? "").localeCompare(b.title ?? "");
      else if (sort.key === "status") cmp = severity(a) - severity(b);
      else if (sort.key === "completion") cmp = (a.completion_percent ?? -1) - (b.completion_percent ?? -1);
      else cmp = a.streak_weeks - b.streak_weeks;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [digest, query, filter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  const needsChasing = (digest?.rows ?? []).filter((r) => !r.reported);
  const chainTotal = chain.reduce((n, s) => n + s.entries, 0);

  if (loading && !digest) return <PortalSkeleton variant="dashboard" />;

  return (
    <div className="portal-ops" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="table-card">
        <div className="portal-ops-head">
          <div>
            <span className="portal-ops-eyebrow">Operations</span>
            <h4>Delivery control centre</h4>
            <p>
              Every project in the organisation for one week: who reported, who did not, and what needs a
              decision from you.
            </p>
          </div>

          <div className="portal-ops-weeknav">
            <button type="button" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
              <ChevronLeft size={15} aria-hidden />
            </button>
            <span>
              <strong>{digest?.label}</strong>
              {digest && <em>{formatRange(digest.period_start, digest.period_end)}</em>}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
              disabled={weekOffset >= 0}
              aria-label="Next week"
            >
              <ChevronRight size={15} aria-hidden />
            </button>
            <button type="button" onClick={load} aria-label="Refresh">
              <RefreshCw size={14} aria-hidden className={loading ? "portal-pulse-spin" : undefined} />
            </button>
          </div>
        </div>

        <div className="portal-ops-kpis">
          <div className="portal-ops-kpi">
            <strong>{digest?.reporting_rate ?? 0}%</strong>
            <span>Reported</span>
            <small>
              {digest?.projects_reported ?? 0} of {digest?.projects_total ?? 0} projects
            </small>
            <i className="portal-ops-rail">
              <b style={{ width: `${digest?.reporting_rate ?? 0}%` }} />
            </i>
          </div>
          <div className={`portal-ops-kpi${needsChasing.length ? " is-alert" : ""}`}>
            <strong>{needsChasing.length}</strong>
            <span>Awaiting a report</span>
            <small>{needsChasing.length ? "Needs chasing" : "Everyone reported"}</small>
          </div>
          <div className={`portal-ops-kpi${digest?.at_risk ? " is-warn" : ""}`}>
            <strong>{digest?.at_risk ?? 0}</strong>
            <span>At risk</span>
            <small>Reported, but slipping</small>
          </div>
          <div className={`portal-ops-kpi${digest?.blocked ? " is-alert" : ""}`}>
            <strong>{digest?.blocked ?? 0}</strong>
            <span>Blocked</span>
            <small>Cannot proceed unaided</small>
          </div>
        </div>

        {needsChasing.length > 0 && (
          <div className="portal-ops-chase">
            <strong>Chase list</strong>
            <p>These projects have filed nothing for {digest?.label}.</p>
            <div className="portal-ops-chips">
              {needsChasing.map((r) => (
                <button
                  key={r.project_id}
                  type="button"
                  onClick={() => router.push(`/portal/projects/${r.project_id}`)}
                >
                  {r.title ?? r.project_id}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="table-card">
        <div className="portal-ops-head">
          <div>
            <h4>Projects</h4>
            <p>Sorted so unreported and blocked work floats to the top. Select a row to open the project.</p>
          </div>
          <div className="portal-ops-controls">
            <label className="portal-ops-search">
              <Search size={14} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
              />
            </label>
            <div className="portal-ops-filters" role="group" aria-label="Filter projects">
              {(["all", "attention", "missing", "reported"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? "is-active" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "attention" ? "Needs attention" : f === "missing" ? "Not reported" : "Reported"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="portal-ops-empty">No projects match this view.</p>
        ) : (
          <table className="portal-ops-table">
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => toggleSort("title")}>
                    Project <ArrowUpDown size={12} aria-hidden />
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("status")}>
                    Status <ArrowUpDown size={12} aria-hidden />
                  </button>
                </th>
                <th>This week</th>
                <th className="num">
                  <button type="button" onClick={() => toggleSort("completion")}>
                    Completion <ArrowUpDown size={12} aria-hidden />
                  </button>
                </th>
                <th className="num">
                  <button type="button" onClick={() => toggleSort("streak")}>
                    Streak <ArrowUpDown size={12} aria-hidden />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.project_id}
                  onClick={() => router.push(`/portal/projects/${r.project_id}`)}
                  className={!r.reported ? "is-missing" : ""}
                >
                  <td>
                    <strong>{r.title ?? "Untitled"}</strong>
                    <small>{r.project_id}</small>
                  </td>
                  <td>
                    {r.reported && r.status ? (
                      <span className={`portal-ops-chip tone-${STATUS_TONE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    ) : (
                      <span className="portal-ops-chip tone-none">Not reported</span>
                    )}
                  </td>
                  <td className="portal-ops-headline">{r.headline ?? "—"}</td>
                  <td className="num">
                    {r.completion_percent == null ? (
                      "—"
                    ) : (
                      <span className="portal-ops-inline-meter">
                        <i style={{ width: `${r.completion_percent}%` }} />
                        {r.completion_percent}%
                      </span>
                    )}
                  </td>
                  <td className="num">{r.streak_weeks}w</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="table-card">
        <div className="portal-ops-head">
          <div>
            <h4>Organisation results chain</h4>
            <p>
              Where evidence accumulates across every project. Stages thin on the right mean the
              organisation is reporting activity but not yet change.
            </p>
          </div>
          <div className="portal-ops-chain-total">
            <strong>{chainTotal}</strong>
            <span>records</span>
          </div>
        </div>

        <ol className="portal-ops-chain">
          {chain.map((stage) => {
            const share = chainTotal ? Math.round((stage.entries / chainTotal) * 100) : 0;
            return (
              <li key={stage.stage} className={stage.entries === 0 ? "is-empty" : ""}>
                <span className="portal-ops-chain-label">{STAGE_LABEL[stage.stage] ?? stage.stage}</span>
                <strong>{stage.entries}</strong>
                <i className="portal-ops-rail">
                  <b style={{ width: `${share}%` }} />
                </i>
                <small>
                  {stage.measured} measured
                  {stage.average_progress != null && ` · ${stage.average_progress}% avg`}
                </small>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
