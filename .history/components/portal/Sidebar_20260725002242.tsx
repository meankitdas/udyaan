"use client";

import {
  ArrowLeft,
  BarChart3,
  Building2,
  Circle,
  ClipboardCheck,
  FilePlus2,
  FileText,
  FolderKanban,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  ListChecks,
  Network,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import LogoutButton from "./LogoutButton";
import type { NavItem } from "@/lib/portal-types";

type SidebarProps = {
  activeTab: string;
  onTabChange: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  title?: string;
  themeColor?: string;
};

const NAV_ICONS = {
  profile: LayoutDashboard,
  dashboard: ArrowLeft,
  insights: BarChart3,
  students: GraduationCap,
  mentors: Handshake,
  orgs: Building2,
  "project-heads": UserCheck,
  projects: FolderKanban,
  "create-project": FilePlus2,
  "view-projects": FolderKanban,
  actions: ListChecks,
  "action-items": ClipboardCheck,
  approvals: ShieldCheck,
  community: Network,
  report: FileText,
  reports: FileText,
  settings: Settings,
} as const;

export default function Sidebar({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  navItems,
  title = "Udyaan Portal",
  themeColor = "#4f46e5",
}: SidebarProps) {
  return (
    <>
      <div className={`overlay ${isOpen ? "open" : ""}`} onClick={onClose} />
      <div className={`dashboard-sidebar ${isOpen ? "open" : ""}`}>
        <div
          className="sidebar-header"
          onClick={() => navItems.length > 0 && onTabChange(navItems[0].id)}
          style={{ cursor: "pointer" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://udyaan-assets.s3.ap-south-1.amazonaws.com/Udyaan.svg"
            alt="Udyaan Logo"
            className="sidebar-logo"
          />
          <span className="sidebar-context">{title}</span>
        </div>
        <p className="sidebar-nav-label">Workspace</p>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.id as keyof typeof NAV_ICONS] ?? Circle;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
                onClick={() => {
                  onTabChange(item.id);
                  if (typeof window !== "undefined" && window.innerWidth <= 768) onClose();
                }}
                style={active ? { ["--nav-accent" as string]: themeColor } as React.CSSProperties : undefined}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
