"use client";

import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck,
  Circle,
  ClipboardCheck,
  FilePlus2,
  FileText,
  FolderKanban,
  Gauge,
  GitBranch,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Network,
  NotebookPen,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Wrench,
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
  users: UserCog,
  control: LayoutGrid,
  ops: Radar,
  dashboard: ArrowLeft,
  insights: BarChart3,
  maturity: Gauge,
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
  copilot: Sparkles,
  report: FileText,
  reports: FileText,
  settings: Settings,

  // Project workspace tabs.
  overview: FileText,
  pulse: CalendarCheck,
  advisor: Sparkles,
  meetings: NotebookPen,
  dependencies: GitBranch,
  impact: TrendingUp,
  tools: Wrench,
} as const;

export default function Sidebar({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  navItems,
  title = "Udyaan Portal",
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
