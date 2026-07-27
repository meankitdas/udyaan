import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "My Network" };

export default function CommunityRequestsPage() {
  return (
    <ProtectedRoute>
      <CommunityPageShell view="requests" />
    </ProtectedRoute>
  );
}
