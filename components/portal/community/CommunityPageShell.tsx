"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CommunityNetwork, { type CommunityView } from "./CommunityNetwork";
import DashboardLayout from "../DashboardLayout";
import PortalSkeleton from "../PortalSkeleton";
import { API_BASE_URL, apiFetch, getRole, getToken, roleHome } from "@/lib/portal-api";
import type { NavItem, Profile } from "@/lib/portal-types";

type CommunityPageShellProps = {
  view: CommunityView;
};

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Organization Admin",
  PROJECT_HEAD: "Project Head",
  FACULTY: "Faculty",
  STUDENT: "Student",
};

const VIEW_TITLES: Record<CommunityView, string> = {
  directory: "Community",
  profile: "Profile",
  me: "My Profile",
  requests: "My Network",
  moderation: "Moderation",
};

/**
 * Standalone wrapper for the /portal/community routes.
 *
 * The network is normally reached as a dashboard tab; these routes exist so a
 * profile can be linked to directly. This puts the same portal chrome around it
 * so a shared link doesn't drop someone into a bare page.
 */
export default function CommunityPageShell({ view }: CommunityPageShellProps) {
  const router = useRouter();
  const params = useParams<{ userId?: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    apiFetch(`${API_BASE_URL}/auth/me`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PortalSkeleton variant="dashboard" />;

  const roleKey = getRole() ?? "";
  const roleLabel = ROLE_LABELS[roleKey] ?? "Member";
  const navItems: NavItem[] = [
    { id: "dashboard", label: "Back to dashboard" },
    { id: "community", label: "Community" },
  ];

  return (
    <DashboardLayout
      activeTab="community"
      onTabChange={(id) => {
        if (id === "dashboard") router.push(roleHome[roleKey] ?? "/portal/student");
      }}
      title={VIEW_TITLES[view]}
      navItems={navItems}
      sidebarTitle={`${roleLabel} Portal`}
      userRole={roleLabel}
      userName={profile?.full_name}
    >
      <CommunityNetwork
        initialView={view}
        initialUserId={params?.userId}
        syncUrl
      />
    </DashboardLayout>
  );
}
