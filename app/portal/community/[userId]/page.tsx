import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "Profile" };

export default function CommunityProfilePage() {
  return (
    <ProtectedRoute>
      <CommunityPageShell view="profile" />
    </ProtectedRoute>
  );
}
