import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "Community Moderation" };

export default function CommunityModerationPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <CommunityPageShell view="moderation" />
    </ProtectedRoute>
  );
}
