"use client";

import { useCallback, useEffect, useState } from "react";
import { Handshake, Tags, Target, Trophy } from "lucide-react";
import RankBadge from "./RankBadge";
import { API_BASE_URL, authHeaders } from "@/lib/portal-api";
import type { LeaderboardEntry, MatchesResponse } from "@/lib/portal-types";

const headingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--dark-green)",
};

export default function CommunityTab() {
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [skillsInput, setSkillsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [mRes, lRes] = await Promise.all([
        fetch(`${API_BASE_URL}/community/matches`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/community/leaderboard`, { headers: authHeaders() }),
      ]);
      if (mRes.ok) {
        const m: MatchesResponse = await mRes.json();
        setMatches(m);
        setSkillsInput(m.my_skills.join(", "));
      }
      if (lRes.ok) setLeaderboard(await lRes.json());
    } catch (err) {
      console.error("Failed to load community data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveSkills = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ skills: skillsInput }),
      });
      if (res.ok) await fetchAll();
      else alert("Failed to save skills");
    } catch {
      alert("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading community...</div>;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Skills editor */}
      <div className="table-card">
        <h4 style={{ ...headingStyle, margin: "0 0 8px 0" }}>
          <Tags size={18} strokeWidth={1.8} aria-hidden /> My Skills
        </h4>
        <p style={{ color: "var(--text-light)", fontSize: "0.9rem", margin: "0 0 16px 0" }}>
          Add your skills (comma separated) to get matched with peers and projects.
        </p>
        <form onSubmit={saveSkills} style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: "240px" }}
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="e.g. python, irrigation, marketing, drone-mapping"
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Skills"}
          </button>
        </form>
        {matches && matches.my_skills.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
            {matches.my_skills.map((s) => (
              <span key={s} className="badge badge-success">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2-cols">
        {/* Peer matches */}
        <div className="table-card">
          <h4 style={{ ...headingStyle, margin: "0 0 16px 0" }}>
            <Handshake size={18} strokeWidth={1.8} aria-hidden /> People You Should Meet
          </h4>
          {!matches || matches.peers.length === 0 ? (
            <p style={{ color: "#666" }}>
              No matches yet — add skills above, and you&apos;ll see peers who share them.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {matches.peers.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "10px", backgroundColor: "#f9fafb", border: "1px solid #eee" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--primary-green)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", flexShrink: 0 }}>
                    {p.full_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-dark)" }}>{p.full_name}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      {p.shared_skills.map((s) => (
                        <span key={s} className="badge badge-gray" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <span className="badge badge-success" title="Skill overlap">{Math.round(p.score * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project matches */}
        <div className="table-card">
          <h4 style={{ ...headingStyle, margin: "0 0 16px 0" }}>
            <Target size={18} strokeWidth={1.8} aria-hidden /> Projects That Need You
          </h4>
          {!matches || matches.projects.length === 0 ? (
            <p style={{ color: "#666" }}>No matching projects right now — check back after adding skills.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {matches.projects.map((p) => (
                <div key={p.id} style={{ padding: "12px", borderRadius: "10px", backgroundColor: "#f9fafb", border: "1px solid #eee" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: "var(--dark-green)" }}>{p.title}</div>
                    <span className="badge badge-warning">{Math.round(p.score * 100)}% fit</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-light)", marginTop: "4px" }}>
                    {p.category || "General"} · {p.status}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                    {p.matched_skills.map((s) => (
                      <span key={s} className="badge badge-success" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="table-card">
        <h4 style={{ ...headingStyle, margin: "0 0 16px 0" }}>
          <Trophy size={18} strokeWidth={1.8} aria-hidden /> Org Leaderboard
        </h4>
        {leaderboard.length === 0 ? (
          <p style={{ color: "#666" }}>No completed action items yet — be the first on the board!</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Completed</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.user_id}>
                    <td style={{ fontSize: "1.1rem" }}>
                      <RankBadge rank={i} />
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--dark-green)" }}>{entry.full_name}</td>
                    <td><span className="badge badge-gray">{entry.role_key ?? "-"}</span></td>
                    <td>{entry.completed} / {entry.total}</td>
                    <td style={{ fontWeight: 700, color: "var(--primary-green)" }}>{entry.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
