"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import PortalSkeleton from "./PortalSkeleton";
import CreateProject from "./CreateProject";
import ProjectList from "./ProjectList";
import InsightsTab from "./InsightsTab";
import AiCopilot from "./AiCopilot";
import CommunityTab from "./CommunityTab";
import { API_BASE_URL, apiFetch, authHeaders } from "@/lib/portal-api";
import type { NavItem, Organization, Profile } from "@/lib/portal-types";

type EditFormData = { full_name: string; phone: string; organization_id: string };

const TAB_TITLES: Record<string, string> = {
  profile: "My Profile",
  insights: "Insights",
  community: "Community",
  copilot: "Udyaan Copilot",
  "create-project": "Create Project",
  "view-projects": "Projects",
};

export default function ProjectHeadDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({ full_name: "", phone: "", organization_id: "" });
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/organizations`, { headers: authHeaders() });
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

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const response = await apiFetch(`${API_BASE_URL}/auth/me`, {
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
      const response = await apiFetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
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

  const renderContent = () => {
    if (loading) return <PortalSkeleton variant="profile" />;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!profile) return <div>No profile data found.</div>;

    if (isEditing) {
      return (
        <div className="card-header">
          <h3>Edit Profile</h3>
          <form onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input name="full_name" value={editFormData.full_name || profile.full_name} onChange={handleEditChange} required />
            </div>
            <div className="form-group" style={{ marginTop: "10px" }}>
              <label>Phone</label>
              <input name="phone" value={editFormData.phone} onChange={handleEditChange} placeholder="Enter phone number" />
            </div>
            <div className="form-group" style={{ marginTop: "10px" }}>
              <label>Organization</label>
              <input value={profile.organization_id || "N/A"} disabled style={{ backgroundColor: "#e9ecef" }} />
              <small className="text-muted">Organization cannot be changed.</small>
            </div>
            <div style={{ marginTop: "20px" }}>
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary" style={{ marginLeft: "10px" }}>
                Cancel
              </button>
            </div>
          </form>
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
      case "community":
        return <CommunityTab />;
      case "copilot":
        return <AiCopilot role="PROJECT_HEAD" />;
      case "profile":
      default:
        return (
          <div className="card-header">
            <h3>Project Head Profile</h3>
            <div className="profile-details">
              <p>
                <strong>Name:</strong> {profile.full_name}
              </p>
              <p>
                <strong>Email:</strong> {profile.email}
              </p>
              <p>
                <strong>Phone:</strong> {profile.phone || "N/A"}
              </p>
              <p>
                <strong>Organization ID:</strong> {profile.organization_id || "N/A"}
              </p>
              <p>
                <strong>Role:</strong> Project Head
              </p>
            </div>
            <button onClick={startEditing} className="btn-primary" style={{ marginTop: "15px" }}>
              Edit Profile
            </button>
          </div>
        );
    }
  };

  const navItems: NavItem[] = [
    { id: "profile", label: "My Profile" },
    { id: "insights", label: "Insights" },
    { id: "community", label: "Community" },
    { id: "copilot", label: "Udyaan Copilot" },
    { id: "create-project", label: "Create Project" },
    { id: "view-projects", label: "View Projects" },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={TAB_TITLES[activeTab] ?? "Project Head Dashboard"}
      navItems={navItems}
      sidebarTitle="Project Portal"
      userRole="Project Head"
      userName={profile?.full_name}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
