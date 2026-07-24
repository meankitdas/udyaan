"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { API_BASE_URL, authHeaders } from "@/lib/portal-api";
import type { Organization, PortalUser } from "@/lib/portal-types";

type Props = {
  org: Organization;
  onBack: () => void;
  onCreateCallback: () => void;
};

export default function OrgAdminList({ org, onBack, onCreateCallback }: Props) {
  const [admins, setAdmins] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  const fetchAdmins = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${org.id}/users`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Failed to fetch admins");
      const data: PortalUser[] = await response.json();
      setAdmins(data.filter((u) => u.role_key === "ADMIN"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this Admin?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${org.id}/admins/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete admin");
      setAdmins(admins.filter((a) => a.id !== userId));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Failed to delete"}`);
    }
  };

  return (
    <div className="table-card">
      <div className="list-header">
        <div>
          <button onClick={onBack} className="btn-secondary" style={{ marginBottom: "10px" }}>
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> Back
          </button>
          <h3>Admins for {org.name}</h3>
        </div>
        <button onClick={onCreateCallback} className="btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden /> Add Admin
        </button>
      </div>

      {loading ? (
        <div>Loading admins...</div>
      ) : (
        <>
          {error && (
            <div className="error-message">Error: {error} (Superadmin view might need backend update)</div>
          )}

          {admins.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              <p>No admins found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td>{admin.full_name}</td>
                      <td>{admin.email}</td>
                      <td>{admin.phone || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="icon-btn delete"
                          title="Delete"
                          aria-label={`Delete ${admin.full_name}`}
                          onClick={() => handleDelete(admin.id)}
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
        </>
      )}
    </div>
  );
}
