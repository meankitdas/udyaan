"use client";

import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { Meeting, MeetingSummary } from "@/lib/portal-types";

/** Render the model's structured result as the plain-text minutes we store. */
function draftToText(draft: MeetingSummary): string {
  const lines: string[] = [draft.summary ?? ""];
  if (draft.decisions?.length) {
    lines.push("", "Decisions:", ...draft.decisions.map((d) => `• ${d}`));
  }
  if (draft.action_items?.length) {
    lines.push("", "Action items:");
    for (const a of draft.action_items) {
      const owner = a.owner ? ` — ${a.owner}` : "";
      const due = a.due_hint ? ` (${a.due_hint})` : "";
      const urgency = a.urgency ? ` [${a.urgency}]` : "";
      lines.push(`• ${a.title ?? ""}${owner}${due}${urgency}`);
    }
  }
  if (draft.risks?.length) {
    lines.push("", "Risks:", ...draft.risks.map((r) => `• ${r}`));
  }
  return lines.join("\n").trim();
}

type Props = {
  meeting: Meeting;
  onSaved: () => void;
  onClose: () => void;
};

export default function MeetingMinutesEditor({ meeting, onSaved, onClose }: Props) {
  const [text, setText] = useState(meeting.mom_content ?? "");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<MeetingSummary | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!notes.trim()) return;
    setDrafting(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE_URL}/ai/meeting-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ notes, meeting_id: meeting.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not turn these notes into minutes.");
      setDraft(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setDrafting(false);
    }
  };

  /** The draft is a suggestion: the writer decides where it lands. */
  const applyDraft = (mode: "replace" | "append") => {
    if (!draft) return;
    const rendered = draftToText(draft);
    setText((current) =>
      mode === "replace" || !current.trim() ? rendered : `${current.trim()}\n\n${rendered}`,
    );
    setDraft(null);
    setNotes("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE_URL}/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mom_content: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not save these minutes.");
      }
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="portal-mom">
      <div className="portal-mom-head">
        <div>
          <strong>{meeting.mom_content ? "Edit minutes" : "Write minutes"}</strong>
          <span>{meeting.title}</span>
        </div>
        <button type="button" className="portal-mom-close" onClick={onClose} aria-label="Close editor">
          <X size={15} aria-hidden />
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <label className="portal-mom-label" htmlFor={`mom-${meeting.id}`}>
        Minutes
      </label>
      <textarea
        id={`mom-${meeting.id}`}
        className="form-control portal-mom-text"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What was discussed, what was decided, and who owns what next."
      />

      <div className="portal-mom-ai">
        <div className="portal-mom-ai-head">
          <Sparkles size={14} aria-hidden />
          <div>
            <strong>Draft from rough notes</strong>
            <span>Paste whatever you scribbled during the meeting — AI structures it into minutes, decisions, actions and risks. You choose whether to keep it.</span>
          </div>
        </div>

        <textarea
          className="form-control"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. talked about sensor delays, Priya to chase vendor by Friday, decided to postpone field trial a week..."
        />

        <button
          type="button"
          className="btn-secondary"
          onClick={generate}
          disabled={drafting || !notes.trim()}
        >
          <Sparkles size={14} aria-hidden />
          {drafting ? "Structuring..." : "Turn into minutes"}
        </button>

        {draft && (
          <div className="portal-mom-draft">
            <span className="portal-mom-draft-tag">Suggested draft</span>

            {draft.summary && (
              <div className="portal-mom-block">
                <h6>Summary</h6>
                <p>{draft.summary}</p>
              </div>
            )}

            {!!draft.decisions?.length && (
              <div className="portal-mom-block">
                <h6>Decisions</h6>
                <ul>
                  {draft.decisions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!draft.action_items?.length && (
              <div className="portal-mom-block">
                <h6>Action items</h6>
                <ul>
                  {draft.action_items.map((a, i) => (
                    <li key={i}>
                      {a.title}
                      {a.owner && <em> — {a.owner}</em>}
                      {a.due_hint && <em> ({a.due_hint})</em>}
                      {a.urgency && <span className="portal-mom-urgency">{a.urgency}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!draft.risks?.length && (
              <div className="portal-mom-block">
                <h6>Risks</h6>
                <ul>
                  {draft.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="portal-mom-draft-actions">
              <button type="button" className="btn-secondary" onClick={() => applyDraft("append")}>
                Add to minutes
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyDraft("replace")}>
                Replace minutes
              </button>
              <button type="button" className="portal-mom-discard" onClick={() => setDraft(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="portal-mom-actions">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          <Check size={15} aria-hidden />
          {saving ? "Saving..." : "Save minutes"}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
