"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { ImpactEntry, ImpactOverview, ImpactStage } from "@/lib/portal-types";

/** The results chain, in the order value actually flows through a project. */
const STAGES: {
  key: ImpactStage;
  label: string;
  question: string;
  hint: string;
  example: string;
}[] = [
  {
    key: "inputs",
    label: "Inputs",
    question: "What did we invest?",
    hint: "Funding, people, equipment, land and partners committed to the project.",
    example: "e.g. 3 faculty mentors, ₹40,000 seed grant",
  },
  {
    key: "process",
    label: "Process",
    question: "What did we do?",
    hint: "The activities that convert those inputs into something real.",
    example: "e.g. 6 field visits, 4 farmer workshops",
  },
  {
    key: "outputs",
    label: "Outputs",
    question: "What did we produce?",
    hint: "Direct, countable deliverables the team can point at.",
    example: "e.g. 1 working prototype, 120 farmers trained",
  },
  {
    key: "outcomes",
    label: "Outcomes",
    question: "What changed?",
    hint: "Short and medium-term change in behaviour, adoption or performance.",
    example: "e.g. water use down 25%, 40 farms adopted",
  },
  {
    key: "impact",
    label: "Impact",
    question: "What lasting difference did it make?",
    hint: "Long-term effect on income, sustainability or the wider system.",
    example: "e.g. average farm income up 18% over 2 seasons",
  },
];

const emptyForm = {
  stage: "inputs" as ImpactStage,
  title: "",
  description: "",
  metric_name: "",
  metric_unit: "",
  baseline_value: "",
  metric_value: "",
  target_value: "",
};

/** Send a number only when the field holds a real one, so blanks stay null. */
function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type Props = {
  projectId: string;
  currentUserId?: string;
  canReview: boolean;
};

export default function ProjectImpact({ projectId, currentUserId, canReview }: Props) {
  const [overview, setOverview] = useState<ImpactOverview | null>(null);
  const [activeStage, setActiveStage] = useState<ImpactStage>("inputs");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/impact`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Could not load the project's results chain.");
      setOverview(await res.json());
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const byStage = useMemo(() => {
    const map = new Map<ImpactStage, ImpactEntry[]>();
    for (const stage of STAGES) map.set(stage.key, []);
    for (const entry of overview?.entries ?? []) {
      map.get(entry.stage)?.push(entry);
    }
    return map;
  }, [overview]);

  const stageSummary = (stage: ImpactStage) =>
    overview?.stages.find((item) => item.stage === stage);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          stage: form.stage,
          title: form.title.trim(),
          description: form.description.trim() || null,
          metric_name: form.metric_name.trim() || null,
          metric_unit: form.metric_unit.trim() || null,
          baseline_value: numberOrNull(form.baseline_value),
          metric_value: numberOrNull(form.metric_value),
          target_value: numberOrNull(form.target_value),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not save this entry.");

      setForm({ ...emptyForm, stage: form.stage });
      setShowForm(false);
      setNotice("Entry recorded.");
      setError("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entryId: string) => {
    if (!confirm("Remove this entry from the results chain?")) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/impact-entries/${entryId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not remove this entry.");
      }
      setNotice("Entry removed.");
      setError("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  if (loading) return <div>Loading results chain...</div>;

  const active = STAGES.find((stage) => stage.key === activeStage)!;
  const activeEntries = byStage.get(activeStage) ?? [];

  return (
    <div className="portal-chain" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && !error && <div className="alert alert-success">{notice}</div>}

      <section className="table-card">
        <div className="portal-chain-head">
          <div>
            <span className="portal-chain-eyebrow">Results chain</span>
            <h4>From what we invest to the difference it makes</h4>
            <p>
              One place for inputs, process, outputs, outcomes and impact — so this project can be judged on
              results, not just activity.
            </p>
          </div>
          <div className="portal-chain-score">
            <strong>{overview?.chain_completeness ?? 0}%</strong>
            <span>chain mapped</span>
          </div>
        </div>

        <ol className="portal-chain-flow">
          {STAGES.map((stage, index) => {
            const summary = stageSummary(stage.key);
            const isActive = stage.key === activeStage;
            return (
              <li key={stage.key}>
                <button
                  type="button"
                  className={`portal-chain-node${isActive ? " is-active" : ""}${
                    (summary?.entries ?? 0) > 0 ? " is-filled" : ""
                  }`}
                  onClick={() => setActiveStage(stage.key)}
                  aria-current={isActive}
                >
                  <span className="portal-chain-step">{index + 1}</span>
                  <strong>{stage.label}</strong>
                  <small>{stage.question}</small>
                  <span className="portal-chain-count">
                    {summary?.entries ?? 0} recorded
                    {summary?.average_progress != null && ` · ${summary.average_progress}%`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="table-card">
        <div className="portal-chain-stage-head">
          <div>
            <h4>
              {active.label} <span>{active.question}</span>
            </h4>
            <p>{active.hint}</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setForm({ ...emptyForm, stage: activeStage });
              setShowForm((open) => !open);
            }}
          >
            <Plus size={15} aria-hidden /> Add to {active.label.toLowerCase()}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="portal-chain-form">
            <div className="grid-2-cols" style={{ gap: "15px" }}>
              <div className="form-group">
                <label>Stage *</label>
                <select
                  className="form-control"
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as ImpactStage })}
                >
                  {STAGES.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>What is it? *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={active.example}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Detail</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional context — how it was measured, who was involved."
              />
            </div>

            <div className="grid-2-cols" style={{ gap: "15px" }}>
              <div className="form-group">
                <label>Metric name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.metric_name}
                  onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
                  placeholder="e.g. Farmers trained"
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.metric_unit}
                  onChange={(e) => setForm({ ...form, metric_unit: e.target.value })}
                  placeholder="e.g. farmers, %, ₹"
                />
              </div>
            </div>

            <div className="grid-3-cols" style={{ gap: "15px" }}>
              <div className="form-group">
                <label>Baseline</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.baseline_value}
                  onChange={(e) => setForm({ ...form, baseline_value: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Current</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.metric_value}
                  onChange={(e) => setForm({ ...form, metric_value: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Target</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.target_value}
                  onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Record entry"}
            </button>
          </form>
        )}

        {activeEntries.length === 0 ? (
          <p className="portal-chain-empty">
            Nothing recorded for {active.label.toLowerCase()} yet. {active.example}
          </p>
        ) : (
          <div className="portal-chain-entries">
            {activeEntries.map((entry) => {
              const canRemove = canReview || entry.recorded_by === currentUserId;
              return (
                <article key={entry.id} className="portal-chain-entry">
                  <div className="portal-chain-entry-main">
                    <strong>{entry.title}</strong>
                    {entry.description && <p>{entry.description}</p>}

                    {entry.metric_value != null && (
                      <div className="portal-chain-metric">
                        <span className="portal-chain-metric-value">
                          {entry.metric_value}
                          {entry.metric_unit ? ` ${entry.metric_unit}` : ""}
                        </span>
                        {entry.metric_name && <span className="portal-chain-metric-name">{entry.metric_name}</span>}
                        {entry.target_value != null && (
                          <span className="portal-chain-metric-target">
                            target {entry.target_value}
                            {entry.metric_unit ? ` ${entry.metric_unit}` : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {entry.progress != null && (
                      <div className="portal-chain-progress" aria-label={`${entry.progress}% of target`}>
                        <span style={{ width: `${entry.progress}%` }} />
                        <i>{entry.progress}%</i>
                      </div>
                    )}

                    <small>Recorded by {entry.recorded_by_name || "a team member"}</small>
                  </div>

                  {canRemove && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => remove(entry.id)}
                      aria-label={`Remove ${entry.title}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
