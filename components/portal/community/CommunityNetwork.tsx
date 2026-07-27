"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Network, ShieldCheck, UserRound } from "lucide-react";
import Directory from "./Directory";
import ModerationPanel from "./ModerationPanel";
import ProfileEditor from "./ProfileEditor";
import ProfileView from "./ProfileView";
import RequestsInbox from "./RequestsInbox";
import { listRequests } from "@/lib/community-api";
import { getRole } from "@/lib/portal-api";

export type CommunityView = "directory" | "profile" | "me" | "requests" | "moderation";

type CommunityNetworkProps = {
  initialView?: CommunityView;
  initialUserId?: string;
  /**
   * Keep the address bar in step with the active view so profiles stay
   * shareable. Only enabled on the standalone /portal/community routes — inside
   * a dashboard tab the URL belongs to the dashboard.
   */
  syncUrl?: boolean;
};

const MODERATOR_ROLES = ["ADMIN", "SUPERADMIN"];

function pathFor(view: CommunityView, userId?: string | null): string {
  if (view === "profile" && userId) return `/portal/community/${userId}`;
  if (view === "me") return "/portal/community/me";
  if (view === "requests") return "/portal/community/requests";
  if (view === "moderation") return "/portal/community/moderation";
  return "/portal/community";
}

export default function CommunityNetwork({
  initialView = "directory",
  initialUserId,
  syncUrl = false,
}: CommunityNetworkProps) {
  const [view, setView] = useState<CommunityView>(initialView);
  const [profileId, setProfileId] = useState<string | null>(initialUserId ?? null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    setIsModerator(MODERATOR_ROLES.includes(getRole() ?? ""));
  }, []);

  // Badge the Requests tab so an incoming mentorship request isn't missed.
  const refreshPending = useCallback(async () => {
    try {
      const { incoming } = await listRequests();
      setPendingCount(incoming.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;
    const next = pathFor(view, profileId);
    if (window.location.pathname !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [syncUrl, view, profileId]);

  const openProfile = useCallback((userId: string) => {
    setProfileId(userId);
    setView("profile");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const go = (next: CommunityView) => {
    setView(next);
    if (next !== "profile") setProfileId(null);
  };

  const navItems: { id: CommunityView; label: string; icon: typeof Network; badge?: number }[] = [
    { id: "directory", label: "Directory", icon: Network },
    { id: "me", label: "My profile", icon: UserRound },
    { id: "requests", label: "Network", icon: Inbox, badge: pendingCount },
    ...(isModerator
      ? [{ id: "moderation" as CommunityView, label: "Moderation", icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="community-shell">
      <nav className="community-nav" aria-label="Community sections">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.id || (view === "profile" && item.id === "directory");
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "active" : ""}
              onClick={() => go(item.id)}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} strokeWidth={1.9} aria-hidden />
              {item.label}
              {item.badge ? <span className="community-nav-badge">{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      {view === "directory" && <Directory onOpenProfile={openProfile} />}

      {view === "profile" && profileId && (
        <ProfileView
          userId={profileId}
          onBack={() => go("directory")}
          onEdit={() => go("me")}
        />
      )}

      {view === "me" && (
        <ProfileEditor onSaved={refreshPending} onViewProfile={openProfile} />
      )}

      {view === "requests" && (
        <RequestsInbox onOpenProfile={openProfile} onCountChange={setPendingCount} />
      )}

      {view === "moderation" && isModerator && (
        <ModerationPanel onOpenProfile={openProfile} />
      )}
    </div>
  );
}
