import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "My Community Profile" };

export default function CommunityMyProfilePage() {
  return (
    <ProtectedRoute>
      <CommunityPageShell view="me" />
    </ProtectedRoute>
  );
}
