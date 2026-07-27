"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, EyeOff, Flag, ShieldCheck } from "lucide-react";
import PortalSkeleton from "../PortalSkeleton";
import { listReports, resolveReport } from "@/lib/community-api";
import type { ModerationAction, ModerationReport } from "@/lib/community-types";

type ModerationPanelProps = {
  onOpenProfile: (userId: string) => void;
};

const STATUSES = ["open", "actioned", "dismissed", "all"] as const;

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  misinformation: "Misinformation",
  inappropriate: "Inappropriate",
  other: "Other",
};

export default function ModerationPanel({ onOpenProfile }: ModerationPanelProps) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("open");
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReports(await listReports(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (report: ModerationReport, action: ModerationAction) => {
    setBusyId(report.id);
    setError("");
    try {
      const updated = await resolveReport(report.id, action, notes[report.id]);
      // An open-queue view should drop the row once it's resolved.
      setReports((prev) =>
        status === "open"
          ? prev.filter((r) => r.id !== report.id)
          : prev.map((r) => (r.id === report.id ? updated : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the report");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PortalSkeleton variant="dashboard" />;

  return (
    <div className="community-moderation">
      <div className="community-tabs" role="tablist">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            className={status === s ? "active" : ""}
            onClick={() => setStatus(s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="community-inline-error">{error}</p>}

      {reports.length === 0 ? (
        <div className="community-empty">
          <ShieldCheck size={28} strokeWidth={1.4} aria-hidden />
          <h4>Nothing to review</h4>
          <p>Reports submitted by members will appear here for triage.</p>
        </div>
      ) : (
        <ul className="community-report-list">
          {reports.map((report) => (
            <li key={report.id} className="table-card community-report">
              <div className="community-report-head">
                <span className="badge badge-warning">
                  <Flag size={12} strokeWidth={2.1} aria-hidden />{" "}
                  {REASON_LABELS[report.reason] ?? report.reason}
                </span>
                <span className="community-report-target">
                  {report.target_type === "user" ? (
                    <button type="button" className="btn-link" onClick={() => onOpenProfile(report.target_id)}>
                      {report.target_label ?? report.target_id}
                    </button>
                  ) : (
                    <>
                      {report.target_type} · {report.target_id}
                    </>
                  )}
                </span>
                <span className={`badge ${report.status === "open" ? "badge-gray" : "badge-success"}`}>
                  {report.status}
                </span>
              </div>

              <p className="community-report-meta">
                Reported by {report.reporter_name ?? report.reporter_id}
                {report.created_at && ` · ${new Date(report.created_at).toLocaleDateString()}`}
              </p>

              {report.details && <p className="community-report-details">{report.details}</p>}

              {report.status === "open" ? (
                <>
                  <input
                    className="form-control"
                    placeholder="Resolution note (optional)"
                    value={notes[report.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [report.id]: e.target.value })}
                  />
                  <div className="community-report-actions">
                    <button
                      type="button"
                      className="community-btn community-btn-sm ghost"
                      onClick={() => act(report, "dismiss")}
                      disabled={busyId === report.id}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="community-btn community-btn-sm outline"
                      onClick={() => act(report, "remove_content")}
                      disabled={busyId === report.id}
                    >
                      <EyeOff size={14} strokeWidth={1.9} aria-hidden />
                      {report.target_type === "user" ? "Hide from directory" : "Remove content"}
                    </button>
                    {report.target_type === "user" && (
                      <button
                        type="button"
                        className="community-btn community-btn-sm danger"
                        onClick={() => act(report, "deactivate_user")}
                        disabled={busyId === report.id}
                      >
                        <Ban size={14} strokeWidth={1.9} aria-hidden /> Deactivate user
                      </button>
                    )}
                  </div>
                </>
              ) : (
                report.resolution_note && (
                  <p className="community-report-resolution">
                    Resolved by {report.resolver_name ?? "a moderator"}: {report.resolution_note}
                  </p>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
