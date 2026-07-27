"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import PortalSkeleton from "./PortalSkeleton";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { Project } from "@/lib/portal-types";

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMyProjects, setShowMyProjects] = useState(false);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMyProjects]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/projects${showMyProjects ? "?created_by_me=true" : ""}`;
      const response = await fetch(url, { headers: authHeaders() });
      const data = await response.json();
      if (response.ok) {
        setProjects(data);
      } else {
        setError(data.detail || "Failed to fetch projects");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to delete project");
      }
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Failed to delete"}`);
    }
  };

  if (loading && projects.length === 0) return <PortalSkeleton variant="table" rows={6} />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="table-card">
      <div className="list-header">
        <div>
          <h3>Projects</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>
            Overview of all ongoing and completed projects
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "0.9rem", color: "var(--text-dark)", fontWeight: 500, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showMyProjects}
              onChange={(e) => setShowMyProjects(e.target.checked)}
              style={{ marginRight: "8px", accentColor: "var(--primary-green)" }}
            />
            Show Assigned by Me
          </label>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No projects found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Deadline</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <Link
                      href={`/portal/projects/${project.id}`}
                      style={{ fontWeight: 600, color: "var(--primary-green)", textDecoration: "none", display: "block" }}
                    >
                      {project.title}
                    </Link>
                    <span style={{ fontSize: "0.8rem", color: "#999" }}>ID: {project.id.substring(0, 8)}...</span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "#f3f4f6",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        color: "#374151",
                      }}
                    >
                      {project.category}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        project.status === "Completed"
                          ? "badge-success"
                          : project.status === "In Progress"
                            ? "badge-warning"
                            : "badge-gray"
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td>{project.deadline ? new Date(project.deadline).toLocaleDateString() : "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/portal/projects/${project.id}`}
                      className="icon-btn"
                      style={{ textDecoration: "none", display: "inline-grid", marginRight: "5px" }}
                      title="View"
                      aria-label={`View ${project.title}`}
                    >
                      <Eye size={16} strokeWidth={1.8} aria-hidden />
                    </Link>
                    <button
                      className="icon-btn delete"
                      title="Delete"
                      aria-label={`Delete ${project.title}`}
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
