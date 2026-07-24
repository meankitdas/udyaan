"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import CreateProject from "./CreateProject";
import ProjectList from "./ProjectList";
import InsightsTab from "./InsightsTab";
import { API_BASE_URL, authHeaders } from "@/lib/portal-api";
import type { ActionItem, NavItem, Organization, PortalUser, Profile } from "@/lib/portal-types";

type EditFormData = { full_name: string; phone: string; organization_id: string };

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({ full_name: "", phone: "", organization_id: "" });
  const [activeTab, setActiveTab] = useState("profile");
  const [pendingUsers, setPendingUsers] = useState<PortalUser[]>([]);
  const [orgUsers, setOrgUsers] = useState<PortalUser[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations`, { headers: authHeaders() });
      if (response.ok) setOrganizations(await response.json());
    } catch (err) {
      console.error("Failed to fetch organizations", err);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditFormData({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      organization_id: profile.organization_id || "",
    });
    setIsEditing(true);
    if (organizations.length === 0) fetchOrganizations();
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const payload = {
        ...editFormData,
        phone: editFormData.phone === "" ? null : editFormData.phone,
        organization_id: editFormData.organization_id === "" ? null : editFormData.organization_id,
      };

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setProfile(await response.json());
        setIsEditing(false);
        alert("Profile updated successfully!");
      } else {
        let errorMsg = "Failed to update profile";
        try {
          const data = await response.json();
          errorMsg = data.detail || errorMsg;
        } catch {
          errorMsg += " (Server returned non-JSON response)";
        }
        alert(errorMsg);
      }
    } catch {
      alert("Network error or server unavailable.");
    }
  };

  useEffect(() => {
    if (profile && !profile.organization_id) {
      setEditFormData({ full_name: profile.full_name || "", phone: profile.phone || "", organization_id: "" });
      fetchOrganizations();
    }
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
      const data = await response.json();
      if (response.ok) {
        setProfile(data);
      } else {
        setError(data.detail || "Failed to fetch profile");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/approvals`, { headers: authHeaders() });
      if (response.ok) setPendingUsers(await response.json());
    } catch (err) {
      console.error("Failed to fetch pending approvals", err);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/approve/${userId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.ok) {
        alert("User approved");
        fetchPendingApprovals();
      } else {
        alert("Failed to approve");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (userId: string) => {
    if (!window.confirm("Are you sure you want to reject (delete) this user?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reject/${userId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.ok) {
        alert("User rejected");
        fetchPendingApprovals();
      } else {
        alert("Failed to reject");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrgUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/users`, { headers: authHeaders() });
      if (response.ok) setOrgUsers(await response.json());
    } catch (err) {
      console.error("Failed to fetch organization users", err);
    }
  };

  const fetchActionItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/action-items`, { headers: authHeaders() });
      if (response.ok) setActionItems(await response.json());
    } catch (err) {
      console.error("Failed to fetch action items", err);
    }
  };

  const approveStudent = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/approve/${userId}`, { method: "POST", headers: authHeaders() });
      if (response.ok) fetchOrgUsers();
      else alert("Failed to approve");
    } catch (err) {
      console.error(err);
    }
  };

  const removeStudent = async (userId: string) => {
    if (!window.confirm("Remove this student? This deletes their account.")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reject/${userId}`, { method: "POST", headers: authHeaders() });
      if (response.ok) fetchOrgUsers();
      else alert("Failed to remove");
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === "approvals") fetchPendingApprovals();
    else if (activeTab === "students" || activeTab === "mentors") fetchOrgUsers();
    else if (activeTab === "action-items") fetchActionItems();
  }, [activeTab]);

  const renderContent = () => {
    if (loading) return <div>Loading profile...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!profile) return <div>No profile data found.</div>;

    const showEditForm = isEditing || !profile.organization_id;

    if (showEditForm) {
      return (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div className="table-card">
            <div style={{ paddingBottom: "20px", marginBottom: "24px", borderBottom: "1px solid #eee" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--dark-green)", margin: 0 }}>
                {profile.organization_id ? "Edit Profile" : "Complete Your Profile"}
              </h3>
              {!profile.organization_id && (
                <p style={{ color: "var(--text-light)", marginTop: "8px" }}>
                  Please select your organization and complete your profile details to proceed.
                </p>
              )}
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="grid-2-cols" style={{ gap: "24px", marginBottom: "24px" }}>
                <div className="form-group">
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "8px", color: "#374151" }}>Full Name</label>
                  <input
                    name="full_name"
                    value={editFormData.full_name || profile.full_name}
                    onChange={handleEditChange}
                    required
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "8px", color: "#374151" }}>Phone Number</label>
                  <input
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleEditChange}
                    placeholder="Enter phone number"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontWeight: 500, marginBottom: "8px", color: "#374151" }}>Organization</label>
                {profile.organization_id ? (
                  <input
                    value={organizations.find((o) => o.id === profile.organization_id)?.name || profile.organization_id}
                    disabled
                    className="form-control"
                    style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}
                  />
                ) : (
                  <select
                    name="organization_id"
                    value={editFormData.organization_id}
                    onChange={handleEditChange}
                    required
                    className="form-control"
                  >
                    <option value="">-- Select Organization --</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                )}
                {profile.organization_id && (
                  <small style={{ display: "block", marginTop: "6px", color: "#6b7280", fontSize: "0.85rem" }}>
                    Organization cannot be changed once joined. Contact Superadmin for transfers.
                  </small>
                )}
              </div>

              <div style={{ display: "flex", gap: "16px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
                <button type="submit" className="btn-primary">
                  {profile.organization_id ? "Save Changes" : "Join & Save Profile"}
                </button>
                {profile.organization_id && (
                  <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "create-project":
        return <CreateProject />;
      case "view-projects":
        return <ProjectList />;
      case "insights":
        return <InsightsTab />;
      case "students": {
        const students = orgUsers.filter((u) => u.role_key === "STUDENT");
        return (
          <div className="table-card">
            <div className="list-header">
              <div>
                <h3>Students</h3>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>Students in your organization</p>
              </div>
            </div>
            {students.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No students found.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600, color: "var(--dark-green)" }}>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td>{s.phone || <span style={{ color: "#ccc" }}>-</span>}</td>
                        <td>
                          <span className={`badge ${s.is_approved ? "badge-success" : "badge-warning"}`}>
                            {s.is_approved ? "Approved" : "Pending"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {!s.is_approved && (
                            <button
                              onClick={() => approveStudent(s.id)}
                              className="btn-primary"
                              style={{ marginRight: "10px", fontSize: "0.8rem", padding: "6px 12px" }}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => removeStudent(s.id)}
                            className="btn-secondary"
                            style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}
                          >
                            Remove
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
      case "mentors": {
        const mentors = orgUsers.filter((u) => u.role_key === "FACULTY" || u.role_key === "PROJECT_HEAD");
        return (
          <div className="table-card">
            <div className="list-header">
              <div>
                <h3>Mentors</h3>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>Faculty and project heads in your organization</p>
              </div>
            </div>
            {mentors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No mentors found.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentors.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600, color: "var(--dark-green)" }}>{m.full_name}</td>
                        <td>{m.email}</td>
                        <td>
                          <span className="badge badge-gray">{m.role_key === "PROJECT_HEAD" ? "Project Head" : "Faculty"}</span>
                        </td>
                        <td>{m.phone || <span style={{ color: "#ccc" }}>-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }
      case "action-items":
        return (
          <div className="table-card">
            <div className="list-header">
              <div>
                <h3>Action Items</h3>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>All action items across your organization&apos;s projects</p>
              </div>
            </div>
            {actionItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No action items found.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Assigned To</th>
                      <th>Urgency</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionItems.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600, color: "var(--dark-green)" }}>{a.title}</td>
                        <td style={{ maxWidth: "300px", whiteSpace: "normal" }}>{a.description}</td>
                        <td>
                          <span className="badge badge-gray">{a.assigned_to.substring(0, 8)}...</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              a.urgency === "Critical"
                                ? "badge-danger"
                                : a.urgency === "High"
                                  ? "badge-warning"
                                  : a.urgency === "Medium"
                                    ? "badge-gray"
                                    : "badge-success"
                            }`}
                          >
                            {a.urgency}
                          </span>
                        </td>
                        <td>{a.due_date}</td>
                        <td>{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case "approvals":
        return (
          <div className="card-header">
            <h3>Pending Approvals</h3>
            {pendingUsers.length === 0 ? (
              <p>No pending approvals.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Registered At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>{user.role_key}</td>
                        <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</td>
                        <td>
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="btn-primary"
                            style={{ marginRight: "10px", fontSize: "0.8rem", padding: "6px 12px" }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            className="btn-secondary"
                            style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}
                          >
                            Reject
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
      case "profile":
      default:
        return (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div className="table-card" style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary-green)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                {profile.full_name ? profile.full_name.charAt(0) : "A"}
              </div>
              <div>
                <h2 style={{ margin: "0 0 8px 0", color: "var(--dark-green)" }}>{profile.full_name}</h2>
                <span className="badge badge-gray" style={{ fontSize: "0.9rem" }}>
                  Organization Admin
                </span>
              </div>
            </div>

            <div className="grid-2-cols">
              <div className="table-card">
                <h4 style={{ margin: "0 0 20px 0", borderBottom: "1px solid #eee", paddingBottom: "12px", color: "var(--dark-green)" }}>
                  Contact Information
                </h4>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "4px" }}>Email Address</label>
                  <div style={{ fontWeight: 500, color: "#4b5563", wordBreak: "break-all" }}>{profile.email}</div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "4px" }}>Phone Number</label>
                  <div style={{ fontWeight: 500, color: "#4b5563" }}>{profile.phone || "Not provided"}</div>
                </div>
              </div>

              <div className="table-card">
                <h4 style={{ margin: "0 0 20px 0", borderBottom: "1px solid #eee", paddingBottom: "12px", color: "var(--dark-green)" }}>
                  Organization Details
                </h4>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "4px" }}>Organization ID</label>
                  <div style={{ fontWeight: 500, color: "#4b5563", fontFamily: "monospace" }}>{profile.organization_id || "Not linked"}</div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "4px" }}>Account Status</label>
                  <span className="badge badge-success">Active</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "24px", textAlign: "right" }}>
              <button onClick={startEditing} className="btn-primary">
                ✏️ Edit Profile
              </button>
            </div>
          </div>
        );
    }
  };

  const navItems: NavItem[] = [
    { id: "profile", label: "My Profile" },
    { id: "insights", label: "Insights" },
    { id: "students", label: "Students" },
    { id: "mentors", label: "Mentors" },
    { id: "create-project", label: "Create Project" },
    { id: "view-projects", label: "View Projects" },
    { id: "action-items", label: "Action Items" },
    { id: "approvals", label: "Pending Approvals" },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Admin Dashboard"
      navItems={navItems}
      sidebarTitle="Admin Portal"
      userRole="Organization Admin"
    >
      {renderContent()}
    </DashboardLayout>
  );
}
