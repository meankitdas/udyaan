"use client";

import { useState } from "react";
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
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const themeColor = getThemeColor(userRole);

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
        <header className="dashboard-header" style={{ borderBottomColor: themeColor }}>
          <button className="mobile-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            ☰
          </button>
          <h2 style={{ color: themeColor }}>{title}</h2>
          <div
            className="user-profile"
            style={{ backgroundColor: themeColor + "20", color: themeColor, padding: "5px 10px", borderRadius: "4px" }}
          >
            {userRole}
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
