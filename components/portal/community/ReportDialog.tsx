"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { reportTarget } from "@/lib/community-api";
import type { ReportReason, ReportTargetType } from "@/lib/community-types";

type ReportDialogProps = {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  onClose: () => void;
};

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or repeated unwanted contact" },
  { value: "harassment", label: "Harassment or abusive behaviour" },
  { value: "misinformation", label: "False or misleading information" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

export default function ReportDialog({
  targetType,
  targetId,
  targetLabel,
  onClose,
}: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await reportTarget({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || undefined,
      });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the report");
      setState("idle");
    }
  };

  return (
    <div className="community-modal-backdrop" role="dialog" aria-modal="true" aria-label="Report">
      <div className="community-modal">
        <header className="community-modal-header">
          <h3>
            <Flag size={17} strokeWidth={1.9} aria-hidden /> Report {targetLabel}
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.9} aria-hidden />
          </button>
        </header>

        {state === "sent" ? (
          <div className="community-modal-body">
            <p>
              Thanks — this has been sent to the moderation team. They&apos;ll review it and
              take action if needed.
            </p>
            <div className="community-modal-footer">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="community-modal-body">
            <label className="community-field">
              <span>Why are you reporting this?</span>
              <select
                className="form-control"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="community-field">
              <span>
                Anything else we should know? <small>(optional)</small>
              </span>
              <textarea
                className="form-control"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                placeholder="Add context that will help a moderator review this."
              />
            </label>

            {error && <p className="community-inline-error">{error}</p>}

            <div className="community-modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={state === "sending"}>
                {state === "sending" ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
