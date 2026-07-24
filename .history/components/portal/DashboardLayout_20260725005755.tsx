"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import type { NavItem } from "@/lib/portal-types";

type DashboardLayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (id: string) => void;
  title: string;
  navItems: NavItem[];
  sidebarTitle: string;
  userRole?: string;
  userName?: string;
};

function getThemeColor(role: string) {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes("super admin")) return "#0F5132"; // Emerald Dark
  if (lowerRole.includes("organization admin") || lowerRole === "admin") return "#0D6EFD"; // Blue
  if (lowerRole.includes("project head")) return "#FD7E14"; // Amber/Orange
  if (lowerRole.includes("faculty")) return "#6610F2"; // Indigo
  if (lowerRole.includes("student")) return "#20C997"; // Teal
  return "#4f46e5"; // Default Indigo
}

export default function DashboardLayout({
  children,
  activeTab,
  onTabChange,
  title,
  navItems,
  sidebarTitle,
  userRole = "User",
  userName,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const themeColor = getThemeColor(userRole);
  const initial = (userName?.trim() || userRole).charAt(0).toUpperCase();

  return (
    <div className="dashboard-layout" style={{ ["--primary-color" as string]: themeColor } as React.CSSProperties}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        navItems={navItems}
        title={sidebarTitle}
        themeColor={themeColor}
      />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button
            type="button"
            className="mobile-toggle"
            aria-label={isSidebarOpen ? "Close navigation" : "Open navigation"}
            title={isSidebarOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="dashboard-title-block">
            <span className="dashboard-kicker">{sidebarTitle}</span>
            <h1>{title}</h1>
          </div>
          <div className="dashboard-header-actions">
            <div className="user-profile" style={{ ["--role-accent" as string]: themeColor } as React.CSSProperties}>
              <span className="user-avatar" aria-hidden>
                {initial}
              </span>
              <span className="user-meta">
                {userName && <strong>{userName}</strong>}
                <small>{userRole}</small>
              </span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
