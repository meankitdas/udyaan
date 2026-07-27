"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PortalSkeleton from "./PortalSkeleton";
import { API_BASE_URL, apiFetch, authHeaders } from "@/lib/portal-api";
import type { PortalUser } from "@/lib/portal-types";

export default function ProjectHeadList({ onCreateNew }: { onCreateNew: () => void }) {
  const [projectHeads, setProjectHeads] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjectHeads();
  }, []);

  const fetchProjectHeads = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/project-heads`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Failed to fetch project heads");
      setProjectHeads(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project heads");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this Project Head? This action cannot be undone.")) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/project-heads/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete project head");
      setProjectHeads(projectHeads.filter((ph) => ph.id !== userId));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Failed to delete"}`);
    }
  };

  if (loading) return <PortalSkeleton variant="table" rows={5} />;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="table-card">
      <div className="list-header">
        <div>
          <h3>Project Heads</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>
            Manage department heads and leaders
          </p>
        </div>
        <button onClick={onCreateNew} className="btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden /> New Project Head
        </button>
      </div>

      {projectHeads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No project heads found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Organization ID</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectHeads.map((ph) => (
                <tr key={ph.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--dark-green)" }}>{ph.full_name}</div>
                  </td>
                  <td>{ph.email}</td>
                  <td>{ph.phone || <span style={{ color: "#ccc" }}>-</span>}</td>
                  <td>
                    <span className="badge badge-gray" style={{ fontSize: "0.8rem" }}>
                      {ph.organization_id ? `${ph.organization_id.substring(0, 8)}...` : "-"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="icon-btn" title="Edit" aria-label={`Edit ${ph.full_name}`}>
                      <Pencil size={16} strokeWidth={1.8} aria-hidden />
                    </button>
                    <button
                      className="icon-btn delete"
                      title="Delete"
                      aria-label={`Delete ${ph.full_name}`}
                      onClick={() => handleDelete(ph.id)}
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
