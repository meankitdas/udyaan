"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { API_BASE_URL, authHeaders } from "@/lib/portal-api";
import type { Organization } from "@/lib/portal-types";

type Props = {
  onCreateNew: () => void;
  onCreateAdmin?: (org: Organization) => void;
};

export default function OrganizationList({ onCreateNew, onCreateAdmin }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Failed to fetch organizations");
      setOrganizations(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch organizations");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (orgId: string) => {
    if (!window.confirm("Are you sure you want to delete this organization? This action cannot be undone.")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete organization");
      setOrganizations(organizations.filter((org) => org.id !== orgId));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Failed to delete"}`);
    }
  };

  if (loading) return <div>Loading organizations...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="table-card">
      <div className="list-header">
        <div>
          <h3>Organizations</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>
            Manage all registered organizations
          </p>
        </div>
        <button onClick={onCreateNew} className="btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden /> New Organization
        </button>
      </div>

      {organizations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No organizations found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--dark-green)" }}>{org.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "#999" }}>ID: {org.id.substring(0, 8)}...</div>
                  </td>
                  <td>{org.email}</td>
                  <td>{org.phone || <span style={{ color: "#ccc" }}>-</span>}</td>
                  <td>{org.address || <span style={{ color: "#ccc" }}>-</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn-link"
                      onClick={() => onCreateAdmin && onCreateAdmin(org)}
                      style={{ marginRight: "10px", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <UserCog size={15} strokeWidth={1.8} aria-hidden /> Manage Admins
                    </button>
                    <button className="icon-btn" title="Edit" aria-label={`Edit ${org.name}`}>
                      <Pencil size={16} strokeWidth={1.8} aria-hidden />
                    </button>
                    <button
                      className="icon-btn delete"
                      title="Delete"
                      aria-label={`Delete ${org.name}`}
                      onClick={() => handleDelete(org.id)}
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
