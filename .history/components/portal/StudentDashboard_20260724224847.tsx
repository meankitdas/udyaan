"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "./DashboardLayout";
import CreateReport from "./CreateReport";
import CommunityTab from "./CommunityTab";
import { API_BASE_URL, authHeaders } from "@/lib/portal-api";
import type { ActionItem, NavItem, Profile, Project } from "@/lib/portal-types";

type EditFormData = { full_name: string; phone: string; organization_id: string };

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({ full_name: "", phone: "", organization_id: "" });
  const [activeTab, setActiveTab] = useState("profile");
  const [projects, setProjects] = useState<Project[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, { headers: authHeaders() });
      if (response.ok) setProjects(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  const fetchActions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/action-items/me`, { headers: authHeaders() });
      if (response.ok) setActions(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (activeTab === "projects") fetchProjects();
    else if (activeTab === "actions") fetchActions();
  }, [activeTab]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
      const data = await response.json();
      if (response.ok) {
        setProfile(data);
        if (!data.organization_id) fetchOrganizations();
      } else {
        setError(data.detail || "Failed to fetch profile");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (profile && !profile.organization_id) {
      setEditFormData({ full_name: profile.full_name || "", phone: profile.phone || "", organization_id: "" });
      fetchOrganizations();
    }
  }, [profile]);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        setProfile(await response.json());
        setIsEditing(false);
        alert("Profile updated successfully!");
      } else {
        const data = await response.json();
        alert(data.detail || "Failed to update profile");
      }
    } catch {
      alert("Network error");
    }
  };

  const renderContent = () => {
    if (loading) return <div>Loading profile...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!profile) return <div>No profile data found.</div>;

    if (isEditing) {
      return (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div className="table-card">
            <div style={{ paddingBottom: "20px", marginBottom: "24px", borderBottom: "1px solid #eee" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--dark-green)", margin: 0 }}>Edit Profile</h3>
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
                <input
                  value={profile.organization_id || "N/A"}
                  disabled
                  className="form-control"
                  style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}
                />
                <small style={{ display: "block", marginTop: "6px", color: "#6b7280", fontSize: "0.85rem" }}>
                  Organization cannot be changed. Contact Admin for transfers.
                </small>
              </div>

              <div style={{ display: "flex", gap: "16px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "projects":
        return (
          <div className="table-card">
            <div className="list-header">
              <div>
                <h3>My Assigned Projects</h3>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>
                  Projects you are currently working on
                </p>
              </div>
            </div>
            {projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No projects assigned yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project Title</th>
                      <th>Status</th>
                      <th>Assigned By</th>
                      <th>Deadline</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link
                            href={`/portal/projects/${p.id}`}
                            style={{ fontWeight: 600, color: "var(--primary-green)", textDecoration: "none" }}
                          >
                            {p.title}
                          </Link>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#6b7280",
                              marginTop: "2px",
                              maxWidth: "300px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {p.description}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              p.status === "Completed" ? "badge-success" : p.status === "In Progress" ? "badge-warning" : "badge-gray"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td>{p.created_by_name || "Unknown"}</td>
                        <td>{p.deadline ? new Date(p.deadline).toLocaleDateString() : "-"}</td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/portal/projects/${p.id}`} className="icon-btn">
                            👁️
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case "actions":
        return (
          <div className="table-card">
            <div className="list-header">
              <div>
                <h3>My Action Items</h3>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>Tasks assigned to you</p>
              </div>
            </div>
            {actions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No action items assigned.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Urgency</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500, color: "var(--dark-green)" }}>{a.title}</td>
                        <td style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.description}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              a.urgency === "Critical" ? "badge-error" : a.urgency === "High" ? "badge-warning" : "badge-gray"
                            }`}
                          >
                            {a.urgency}
                          </span>
                        </td>
                        <td>{a.due_date ? new Date(a.due_date).toLocaleDateString() : "-"}</td>
                        <td>{a.status}</td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/portal/projects/${a.project_id}`} className="icon-btn">
                            👁️ View Project
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case "report":
        return <CreateReport role="student" />;
      case "community":
        return <CommunityTab />;
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
                  backgroundColor: "var(--secondary-blue)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                }}
              >
                {profile.full_name ? profile.full_name.charAt(0) : "S"}
              </div>
              <div>
                <h2 style={{ margin: "0 0 8px 0", color: "var(--dark-green)" }}>{profile.full_name}</h2>
                <span className="badge badge-gray" style={{ fontSize: "0.9rem" }}>
                  Student
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
    { id: "projects", label: "My Projects" },
    { id: "actions", label: "My Action Items" },
    { id: "community", label: "Community" },
    { id: "report", label: "Submit Report" },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Student Dashboard"
      navItems={navItems}
      sidebarTitle="Student Portal"
      userRole="Student"
    >
      {renderContent()}
    </DashboardLayout>
  );
}
