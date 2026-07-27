"use client";

import CommunityNetwork from "./community/CommunityNetwork";

/**
 * Community tab for the role dashboards.
 *
 * Replaces the previous skills/leaderboard tab with the full professional
 * network. The dashboard owns the URL here, so URL syncing stays off; the
 * standalone /portal/community routes turn it on for shareable profile links.
 */
export default function CommunityTab() {
  return <CommunityNetwork />;
}
