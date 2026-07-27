"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarCheck, Pause, Play, Plus, RefreshCw } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { ProjectPulse as Pulse, PulseMode, UpdateStatus, WeeklyUpdate } from "@/lib/portal-types";

/** How often the live view re-reads the dashboard. */
const REFRESH_MS = 15000;

const STATUS_META: Record<UpdateStatus, { label: string; tone: string }> = {
  on_track: { label: "On track", tone: "ok" },
  at_risk: { label: "At risk", tone: "warn" },
  blocked: { label: "Blocked", tone: "bad" },
  completed: { label: "Completed", tone: "done" },
};

const emptyForm = {
  status: "on_track" as UpdateStatus,
  headline: "",
  progress_note: "",
  blockers: "",
  next_steps: "",
  completion_percent: "",
  period: "current" as "current" | "previous",
};

function mondayOf(offsetWeeks: number): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  now.setDate(now.getDate() - day - offsetWeeks * 7);
  return now.toISOString().slice(0, 10);
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
}

function relativeTime(fromMs: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - fromMs) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type Props = {
  projectId: string;
};

export default function ProjectPulse({ projectId }: Props) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [mode, setMode] = useState<PulseMode>("weekly");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [now, setNow] = useState(() => Date.now());
  // When this client last received data. Used for the freshness readout instead
  // of the server clock, so skew between the two can't show "updated 6h ago".
  const [lastFetched, setLastFetched] = useState(() => Date.now());

  // Guards an auto-refresh from firing while the previous one is still in flight.
  const inFlight = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/pulse?mode=${mode}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Could not load the project dashboard.");
        setPulse(await res.json());
        setLastFetched(Date.now());
        setNow(Date.now());
        setError("");
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        inFlight.current = false;
        setRefreshing(false);
        setLoading(false);
      }
    },
    [projectId, mode],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Real-time option: poll only while the live tab is open and not paused, so
  // the weekly view stays a stable snapshot and we don't poll in the background.
  useEffect(() => {
    if (mode !== "live" || !autoRefresh) return;
    const id = window.setInterval(() => load(true), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [mode, autoRefresh, load]);

  // Drives the "updated Xs ago" readout.
  useEffect(() => {
    if (mode !== "live") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  const cadence = pulse?.cadence;
  const counters = pulse?.counters;

  const dueLabel = useMemo(() => {
    if (!cadence) return "";
    return new Date(cadence.due_at).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [cadence]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.headline.trim()) return;

    setSaving(true);
    try {
      const completion = form.completion_percent.trim();
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/weekly-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          period_start: mondayOf(form.period === "previous" ? 1 : 0),
          status: form.status,
          headline: form.headline.trim(),
          progress_note: form.progress_note.trim() || null,
          blockers: form.blockers.trim() || null,
          next_steps: form.next_steps.trim() || null,
          completion_percent: completion ? Number(completion) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not save this week's record.");

      setForm(emptyForm);
      setShowForm(false);
      setNotice("Weekly record filed.");
      setError("");
      await load(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (updateId: string) => {
    if (!confirm("Remove this weekly record?")) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/weekly-updates/${updateId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not remove this record.");
      }
      setNotice("Weekly record removed.");
      setError("");
      await load(true);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  if (loading && !pulse) return <div>Loading dashboard...</div>;

  const tiles = counters
    ? [
        { label: "Meetings held", value: counters.meetings_total, sub: `${counters.meetings_this_week} this week` },
        { label: "Open actions", value: counters.actions_open, sub: `${counters.actions_overdue} overdue`, alert: counters.actions_overdue > 0 },
        { label: "Actions closed", value: `${counters.action_completion_rate}%`, sub: `${counters.actions_completed} completed` },
        { label: "Impact records", value: counters.impact_entries, sub: "across the results chain" },
        { label: "Tools connected", value: counters.tools_connected, sub: "approved workspaces" },
        { label: "Reporting streak", value: `${cadence?.streak_weeks ?? 0}w`, sub: `${cadence?.on_time_rate ?? 0}% on time` },
      ]
    : [];

  return (
    <div className="portal-pulse" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && !error && <div className="alert alert-success">{notice}</div>}

      <section className="table-card">
        <div className="portal-pulse-head">
          <div>
            <span className="portal-pulse-eyebrow">Project dashboard</span>
            <h4>{pulse?.project_title || "Weekly pulse"}</h4>
            <p>
              A record every week, plus a live feed when you need the current picture. Weekly figures are frozen
              at the close of the reported week so reviews stay consistent.
            </p>
          </div>

          <div className="portal-pulse-controls">
            <div className="portal-pulse-modes" role="tablist" aria-label="Dashboard mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "weekly"}
                className={`portal-pulse-mode${mode === "weekly" ? " is-active" : ""}`}
                onClick={() => setMode("weekly")}
              >
                <CalendarCheck size={14} aria-hidden /> Weekly
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "live"}
                className={`portal-pulse-mode${mode === "live" ? " is-active" : ""}`}
                onClick={() => setMode("live")}
              >
                <Activity size={14} aria-hidden /> Live
              </button>
            </div>

            <div className="portal-pulse-meta">
              {mode === "live" ? (
                <>
                  <span className={`portal-pulse-live${autoRefresh ? " is-on" : ""}`}>
                    <i aria-hidden />
                    {autoRefresh ? "Live" : "Paused"}
                  </span>
                  <span className="portal-pulse-stamp">
                    {pulse ? `updated ${relativeTime(lastFetched, now)}` : ""}
                  </span>
                  <button
                    type="button"
                    className="portal-pulse-icon"
                    onClick={() => setAutoRefresh((on) => !on)}
                    aria-label={autoRefresh ? "Pause live updates" : "Resume live updates"}
                    title={autoRefresh ? "Pause live updates" : "Resume live updates"}
                  >
                    {autoRefresh ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
                  </button>
                </>
              ) : (
                <span className="portal-pulse-stamp">
                  {pulse ? `as of ${new Date(pulse.as_of).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
                </span>
              )}
              <button
                type="button"
                className="portal-pulse-icon"
                onClick={() => load(true)}
                aria-label="Refresh now"
                title="Refresh now"
              >
                <RefreshCw size={14} aria-hidden className={refreshing ? "portal-pulse-spin" : undefined} />
              </button>
            </div>
          </div>
        </div>

        {cadence && (
          <div className={`portal-pulse-cadence${cadence.reported ? " is-reported" : " is-due"}`}>
            <div className="portal-pulse-cadence-main">
              <span className="portal-pulse-week">{cadence.label}</span>
              <strong>{formatRange(cadence.period_start, cadence.period_end)}</strong>
              {cadence.reported && cadence.current ? (
                <p>
                  <span className={`portal-pulse-chip tone-${STATUS_META[cadence.current.status].tone}`}>
                    {STATUS_META[cadence.current.status].label}
                  </span>
                  {cadence.current.headline}
                </p>
              ) : (
                <p>No record filed for this week yet — due {dueLabel}.</p>
              )}
            </div>
            <div className="portal-pulse-cadence-stats">
              <div>
                <strong>{cadence.weeks_reported}</strong>
                <span>weeks recorded</span>
              </div>
              <div>
                <strong>{cadence.on_time_rate}%</strong>
                <span>filed on time</span>
              </div>
              <div>
                <strong>{cadence.missed_weeks.length}</strong>
                <span>weeks missed</span>
              </div>
            </div>
          </div>
        )}

        {cadence && cadence.missed_weeks.length > 0 && (
          <p className="portal-pulse-missed">
            Missing records: {cadence.missed_weeks.join(", ")}
          </p>
        )}
      </section>

      <section className="table-card">
        <div className="portal-pulse-stage-head">
          <div>
            <h4>
              {mode === "live" ? "Right now" : "At the close of the reported week"}
            </h4>
            <p>
              {mode === "live"
                ? `Recalculated every ${REFRESH_MS / 1000} seconds while this tab is open.`
                : "Frozen figures — the same numbers for everyone reviewing this week."}
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowForm((open) => !open)}>
            <Plus size={15} aria-hidden /> Record this week
          </button>
        </div>

        <div className="portal-pulse-tiles">
          {tiles.map((tile) => (
            <div key={tile.label} className={`portal-pulse-tile${tile.alert ? " is-alert" : ""}`}>
              <strong>{tile.value}</strong>
              <span>{tile.label}</span>
              <small>{tile.sub}</small>
            </div>
          ))}
        </div>

        {showForm && (
          <form onSubmit={submit} className="portal-pulse-form">
            <div className="grid-3-cols" style={{ gap: "15px" }}>
              <div className="form-group">
                <label>Week</label>
                <select
                  className="form-control"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value as "current" | "previous" })}
                >
                  <option value="current">This week</option>
                  <option value="previous">Last week</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status *</label>
                <select
                  className="form-control"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as UpdateStatus })}
                >
                  {(Object.keys(STATUS_META) as UpdateStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {STATUS_META[key].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Completion %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  className="form-control"
                  value={form.completion_percent}
                  onChange={(e) => setForm({ ...form, completion_percent: e.target.value })}
                  placeholder="0 – 100"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Headline *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="One line a reviewer can scan — what moved this week?"
              />
            </div>

            <div className="form-group">
              <label>Progress</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.progress_note}
                onChange={(e) => setForm({ ...form, progress_note: e.target.value })}
                placeholder="What was completed, measured or decided."
              />
            </div>

            <div className="grid-2-cols" style={{ gap: "15px" }}>
              <div className="form-group">
                <label>Blockers</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.blockers}
                  onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                  placeholder="What is holding the team up, and who can unblock it."
                />
              </div>
              <div className="form-group">
                <label>Next steps</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.next_steps}
                  onChange={(e) => setForm({ ...form, next_steps: e.target.value })}
                  placeholder="What the team commits to before the next review."
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : "File record"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
            <p className="portal-pulse-hint">
              Re-filing a week replaces its record — there is always exactly one per week.
            </p>
          </form>
        )}
      </section>

      <section className="table-card">
        <div className="portal-pulse-stage-head">
          <div>
            <h4>Weekly record</h4>
            <p>The written history of this project, one entry per week.</p>
          </div>
        </div>

        {!pulse?.recent_updates.length ? (
          <p className="portal-pulse-empty">
            No weeks recorded yet. File the first one to start the history.
          </p>
        ) : (
          <ol className="portal-pulse-log">
            {pulse.recent_updates.map((entry: WeeklyUpdate) => (
              <li key={entry.id} className={`portal-pulse-entry tone-${STATUS_META[entry.status].tone}`}>
                <div className="portal-pulse-entry-head">
                  <div>
                    <span className="portal-pulse-week">{entry.label}</span>
                    <strong>{entry.headline}</strong>
                    <small>
                      {formatRange(entry.period_start, entry.period_end)}
                      {entry.submitted_by_name ? ` · ${entry.submitted_by_name}` : ""}
                      {entry.submitted_late ? " · filed late" : ""}
                    </small>
                  </div>
                  <div className="portal-pulse-entry-actions">
                    <span className={`portal-pulse-chip tone-${STATUS_META[entry.status].tone}`}>
                      {STATUS_META[entry.status].label}
                    </span>
                    <button
                      type="button"
                      className="portal-pulse-icon"
                      onClick={() => remove(entry.id)}
                      aria-label={`Remove record for ${entry.label}`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {entry.completion_percent != null && (
                  <div className="portal-pulse-bar" aria-label={`${entry.completion_percent}% complete`}>
                    <span style={{ width: `${entry.completion_percent}%` }} />
                    <em>{entry.completion_percent}%</em>
                  </div>
                )}

                {entry.progress_note && <p>{entry.progress_note}</p>}
                {entry.blockers && (
                  <p className="portal-pulse-blockers">
                    <strong>Blockers:</strong> {entry.blockers}
                  </p>
                )}
                {entry.next_steps && (
                  <p className="portal-pulse-next">
                    <strong>Next:</strong> {entry.next_steps}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
