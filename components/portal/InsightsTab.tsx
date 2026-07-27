"use client";

import { useEffect, useState } from "react";
import { CircleCheckBig, Clock, Trophy } from "lucide-react";
import RankBadge from "./RankBadge";
import PortalSkeleton from "./PortalSkeleton";
import { API_BASE_URL, apiFetch, authHeaders } from "@/lib/portal-api";
import type { LeaderboardEntry, OrgInsights } from "@/lib/portal-types";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admins",
  ADMIN: "Admins",
  PROJECT_HEAD: "Project Heads",
  FACULTY: "Faculty",
  STUDENT: "Students",
};

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="table-card" style={{ padding: "20px" }}>
      <div style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color: accent ?? "var(--dark-green)" }}>{value}</div>
    </div>
  );
}

export default function InsightsTab() {
  const [insights, setInsights] = useState<OrgInsights | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch(`${API_BASE_URL}/community/insights`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`${API_BASE_URL}/community/leaderboard`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([ins, lb]) => {
        setInsights(ins);
        setLeaderboard(lb);
      })
      .catch((err) => console.error("Failed to load insights", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PortalSkeleton variant="dashboard" />;
  if (!insights) return <div className="alert alert-danger">Failed to load insights.</div>;

  const completionPct = insights.action_items_total
    ? Math.round((insights.action_items_completed / insights.action_items_total) * 100)
    : 0;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* People */}
      <div className="grid-auto-fit">
        {Object.entries(insights.users_by_role).map(([role, count]) => (
          <StatCard key={role} label={ROLE_LABELS[role] ?? role} value={count} />
        ))}
        <StatCard label="Pending Approvals" value={insights.pending_approvals} accent={insights.pending_approvals ? "#c2410c" : undefined} />
      </div>

      {/* Projects & action items */}
      <div className="grid-auto-fit">
        {Object.entries(insights.projects_by_status).map(([status, count]) => (
          <StatCard key={status} label={`Projects · ${status}`} value={count} />
        ))}
        <StatCard label="Action Items Completed" value={`${insights.action_items_completed} / ${insights.action_items_total}`} accent="var(--primary-green)" />
        <StatCard label="Overdue Action Items" value={insights.action_items_overdue} accent={insights.action_items_overdue ? "var(--error-red)" : undefined} />
      </div>

      {/* Completion bar */}
      <div className="table-card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
          <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "var(--dark-green)" }}>
            <CircleCheckBig size={18} strokeWidth={1.8} aria-hidden /> Org Task Completion
          </h4>
          <strong style={{ color: "var(--primary-green)" }}>{completionPct}%</strong>
        </div>
        <div style={{ height: "12px", borderRadius: "6px", backgroundColor: "#f3f4f6", overflow: "hidden" }}>
          <div style={{ width: `${completionPct}%`, height: "100%", borderRadius: "6px", backgroundColor: "var(--primary-green)", transition: "width .4s ease" }} />
        </div>
      </div>

      <div className="grid-2-cols">
        {/* Upcoming deadlines */}
        <div className="table-card">
          <h4 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px", color: "var(--dark-green)" }}>
            <Clock size={18} strokeWidth={1.8} aria-hidden /> Deadlines (Next 14 Days)
          </h4>
          {insights.upcoming_deadlines.length === 0 ? (
            <p style={{ color: "#666" }}>No deadlines in the next two weeks.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {insights.upcoming_deadlines.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--dark-green)" }}>{d.title}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>{d.status}</div>
                  </div>
                  <span className="badge badge-warning">{new Date(d.deadline).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="table-card">
          <h4 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px", color: "var(--dark-green)" }}>
            <Trophy size={18} strokeWidth={1.8} aria-hidden /> Top Contributors
          </h4>
          {leaderboard.length === 0 ? (
            <p style={{ color: "#666" }}>No completed action items yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {leaderboard.slice(0, 5).map((entry, i) => (
                <div key={entry.user_id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "10px", backgroundColor: "#f9fafb", border: "1px solid #eee" }}>
                  <span style={{ display: "inline-flex", justifyContent: "center", width: "28px" }}>
                    <RankBadge rank={i} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-dark)" }}>{entry.full_name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>{entry.completed} tasks completed</div>
                  </div>
                  <strong style={{ color: "var(--primary-green)" }}>{entry.points} pts</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
