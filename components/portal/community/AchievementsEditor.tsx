"use client";

import { useEffect, useState } from "react";
import { Award, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  addAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/lib/community-api";
import type { Achievement, AchievementInput } from "@/lib/community-types";

type AchievementsEditorProps = {
  achievements: Achievement[];
  onChange: (next: Achievement[]) => void;
};

const BLANK: AchievementInput = {
  title: "",
  issuer: "",
  achieved_on: "",
  description: "",
  url: "",
};

export default function AchievementsEditor({
  achievements,
  onChange,
}: AchievementsEditorProps) {
  const [draft, setDraft] = useState<AchievementInput>(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingId) return;
    const target = achievements.find((a) => a.id === editingId);
    if (target) {
      setDraft({
        title: target.title,
        issuer: target.issuer ?? "",
        achieved_on: target.achieved_on ?? "",
        description: target.description ?? "",
        url: target.url ?? "",
      });
    }
  }, [editingId, achievements]);

  const reset = () => {
    setDraft(BLANK);
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;

    setBusy(true);
    setError("");
    // Empty date/URL inputs come through as "", which the API rejects for a
    // date column — send null instead of an empty string.
    const payload: AchievementInput = {
      title: draft.title.trim(),
      issuer: draft.issuer?.trim() || null,
      achieved_on: draft.achieved_on || null,
      description: draft.description?.trim() || null,
      url: draft.url?.trim() || null,
    };

    try {
      if (editingId) {
        const updated = await updateAchievement(editingId, payload);
        onChange(achievements.map((a) => (a.id === editingId ? updated : a)));
      } else {
        const created = await addAchievement(payload);
        onChange([...achievements, created]);
      }
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the achievement");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await deleteAchievement(id);
      onChange(achievements.filter((a) => a.id !== id));
      if (editingId === id) reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the achievement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="table-card">
      <h4 className="community-section-title">
        <Award size={16} strokeWidth={1.9} aria-hidden /> Achievements
      </h4>

      {achievements.length > 0 && (
        <ul className="community-achievements editable">
          {achievements.map((a) => (
            <li key={a.id}>
              <div className="community-achievement-head">
                <strong>{a.title}</strong>
                <div className="community-achievement-actions">
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setEditingId(a.id)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => remove(a.id)}
                    disabled={busy}
                    aria-label={`Delete ${a.title}`}
                  >
                    <Trash2 size={15} strokeWidth={1.9} aria-hidden />
                  </button>
                </div>
              </div>
              {(a.issuer || a.achieved_on) && (
                <p className="community-achievement-issuer">
                  {[a.issuer, a.achieved_on].filter(Boolean).join(" · ")}
                </p>
              )}
              {a.description && <p>{a.description}</p>}
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  View <ExternalLink size={12} strokeWidth={2} aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="community-achievement-form">
        <p className="community-filter-label">
          {editingId ? "Edit achievement" : "Add an achievement"}
        </p>

        <div className="community-field-row">
          <label className="community-field">
            <span>Title</span>
            <input
              className="form-control"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Best Paper, National Agri-Tech Summit"
              maxLength={200}
              required
            />
          </label>
          <label className="community-field">
            <span>Issued by</span>
            <input
              className="form-control"
              value={draft.issuer ?? ""}
              onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
              placeholder="Organisation or institution"
              maxLength={150}
            />
          </label>
        </div>

        <div className="community-field-row">
          <label className="community-field">
            <span>Date</span>
            <input
              type="date"
              className="form-control"
              value={draft.achieved_on ?? ""}
              onChange={(e) => setDraft({ ...draft, achieved_on: e.target.value })}
            />
          </label>
          <label className="community-field">
            <span>Proof link</span>
            <input
              type="url"
              className="form-control"
              value={draft.url ?? ""}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
            />
          </label>
        </div>

        <label className="community-field">
          <span>Description</span>
          <textarea
            className="form-control"
            rows={2}
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="One or two lines about what this was for."
          />
        </label>

        {error && <p className="community-inline-error">{error}</p>}

        <div className="community-form-actions">
          {editingId && (
            <button type="button" className="btn-secondary" onClick={reset} disabled={busy}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={busy || !draft.title.trim()}>
            <Plus size={15} strokeWidth={2} aria-hidden />
            {busy ? "Saving…" : editingId ? "Save changes" : "Add achievement"}
          </button>
        </div>
      </form>
    </section>
  );
}
