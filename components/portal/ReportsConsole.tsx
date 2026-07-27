"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, RefreshCw, Search } from "lucide-react";
import PortalSkeleton from "./PortalSkeleton";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { ReportDetail } from "@/lib/portal-types";

/**
 * Reports console.
 *
 * Reports were write-only until now — students and faculty could submit them
 * and nobody could read one back. This is the read side. Visibility is enforced
 * server-side by reporting line, so this component simply renders what it is
 * given rather than trying to filter by role itself.
 */
export default function ReportsConsole() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/reports`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Could not load reports.");
      setReports(await res.json());
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

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports) map.set(r.project_id, r.project_title ?? r.project_id);
    return [...map.entries()];
  }, [reports]);

  // Filtering stays client-side: the server already caps the set at 200 rows,
  // so refetching on every keystroke would cost more than it saves.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (project !== "all" && r.project_id !== project) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        (r.submitted_by_name ?? "").toLowerCase().includes(q) ||
        (r.submitted_to_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [reports, query, project]);

  if (loading && !reports.length) return <PortalSkeleton variant="table" rows={6} />;

  return (
    <div className="portal-reports" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="table-card">
        <div className="portal-cc-head">
          <div>
            <span className="portal-cc-eyebrow">Reporting line</span>
            <h4>Reports</h4>
            <p>
              Everything students have submitted to faculty and faculty to project heads, in the scope you
              are allowed to see.
            </p>
          </div>
          <div className="portal-cc-actions">
            <label className="portal-ops-search">
              <Search size={14} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports"
                aria-label="Search reports"
              />
            </label>
            {projects.length > 1 && (
              <select
                className="portal-cc-input"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                aria-label="Filter by project"
              >
                <option value="all">All projects</option>
                {projects.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn-secondary" onClick={load}>
              <RefreshCw size={14} aria-hidden className={loading ? "portal-pulse-spin" : undefined} />
              Refresh
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="portal-reports-empty">
            <FileText size={22} aria-hidden />
            <strong>{reports.length ? "No reports match this view." : "No reports yet."}</strong>
            <span>
              {reports.length
                ? "Try clearing the search or project filter."
                : "Reports appear here once students submit to faculty, or faculty to project heads."}
            </span>
          </div>
        ) : (
          <ol className="portal-reports-list">
            {visible.map((r) => {
              const open = openId === r.id;
              return (
                <li key={r.id} className={open ? "is-open" : ""}>
                  <button
                    type="button"
                    className="portal-reports-row"
                    onClick={() => setOpenId(open ? null : r.id)}
                    aria-expanded={open}
                  >
                    <div>
                      <strong>{r.title}</strong>
                      <small>
                        {r.submitted_by_name ?? r.submitted_by} → {r.submitted_to_name ?? r.submitted_to}
                        {r.project_title && ` · ${r.project_title}`}
                      </small>
                    </div>
                    <time>
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                    <ChevronDown size={15} aria-hidden className="portal-reports-caret" />
                  </button>

                  {open && (
                    <div className="portal-reports-body">
                      <p>{r.content}</p>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => router.push(`/portal/projects/${r.project_id}`)}
                      >
                        Open project
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {reports.length > 0 && (
          <p className="portal-reports-count">
            Showing {visible.length} of {reports.length}
          </p>
        )}
      </section>
    </div>
  );
}
