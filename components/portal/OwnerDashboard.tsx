"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import CommunityTab from "./CommunityTab";
import ControlCentre from "./ControlCentre";
import CreateOrgAdmin from "./CreateOrgAdmin";
import CreateOrganization from "./CreateOrganization";
import CreateProjectHead from "./CreateProjectHead";
import OrgAdminList from "./OrgAdminList";
import OrgMaturity from "./OrgMaturity";
import OrganizationList from "./OrganizationList";
import ProjectHeadList from "./ProjectHeadList";
import ProjectList from "./ProjectList";
import ReportsConsole from "./ReportsConsole";
import UserManagement from "./UserManagement";
import { API_BASE_URL, apiFetch, authHeaders } from "@/lib/portal-api";
import type { NavItem, Organization, OwnerOverview } from "@/lib/portal-types";

const TAB_TITLES: Record<string, string> = {
  users: "User Management",
  control: "Control Centre",
  orgs: "Organizations",
  "project-heads": "Project Heads",
  projects: "All Projects",
  reports: "Reports",
  maturity: "Digital Maturity Index",
  community: "Community",
};

function OverviewStrip() {
  const [overview, setOverview] = useState<OwnerOverview | null>(null);

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/owner/overview`, { headers: authHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  if (!overview) return null;

  const cards = [
    { label: "Total users", value: overview.total_users },
    { label: "Active", value: overview.active_users },
    { label: "Pending approval", value: overview.pending_approval },
    { label: "Organizations", value: overview.organizations },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "20px",
      }}
    >
      {cards.map((card) => (
        <div key={card.label} className="table-card" style={{ padding: "16px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>{card.label}</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--dark-green)" }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState("users");
  const [viewMode, setViewMode] = useState<"list" | "create" | "manage-admins" | "create-admin">("list");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setViewMode("list");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "users":
        return (
          <>
            <OverviewStrip />
            <UserManagement />
          </>
        );
      case "control":
        return <ControlCentre />;
      case "maturity":
        return <OrgMaturity />;
      case "reports":
        return <ReportsConsole />;
      case "community":
        return <CommunityTab />;
      case "projects":
        return <ProjectList />;
      case "project-heads":
        if (viewMode === "list") {
          return <ProjectHeadList onCreateNew={() => setViewMode("create")} />;
        }
        return (
          <div className="form-card">
            <div style={{ marginBottom: "20px" }}>
              <button onClick={() => setViewMode("list")} className="btn-secondary">
                <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> Back to List
              </button>
            </div>
            <CreateProjectHead />
          </div>
        );
      case "orgs":
        if (viewMode === "list") {
          return (
            <OrganizationList
              onCreateNew={() => setViewMode("create")}
              onCreateAdmin={(org) => {
                setSelectedOrg(org);
                setViewMode("manage-admins");
              }}
            />
          );
        }
        if (viewMode === "manage-admins" && selectedOrg) {
          return (
            <OrgAdminList
              org={selectedOrg}
              onBack={() => setViewMode("list")}
              onCreateCallback={() => setViewMode("create-admin")}
            />
          );
        }
        if (viewMode === "create-admin" && selectedOrg) {
          return (
            <div className="form-card">
              <CreateOrgAdmin org={selectedOrg} onBack={() => setViewMode("manage-admins")} />
            </div>
          );
        }
        return (
          <div className="form-card">
            <div style={{ marginBottom: "20px" }}>
              <button onClick={() => setViewMode("list")} className="btn-secondary">
                <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> Back to List
              </button>
            </div>
            <CreateOrganization />
          </div>
        );
      default:
        return null;
    }
  };

  const navItems: NavItem[] = [
    { id: "users", label: "User Management" },
    { id: "control", label: "Control Centre" },
    { id: "orgs", label: "Organizations" },
    { id: "project-heads", label: "Project Heads" },
    { id: "projects", label: "View All Projects" },
    { id: "reports", label: "Reports" },
    { id: "maturity", label: "Digital Maturity" },
    { id: "community", label: "Community" },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      title={TAB_TITLES[activeTab] ?? "Owner Console"}
      navItems={navItems}
      sidebarTitle="Owner Console"
      userRole="Owner"
    >
      {renderContent()}
    </DashboardLayout>
  );
}
