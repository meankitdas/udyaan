import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "Discover" };

export default function CommunitySuggestionsPage() {
  return (
    <ProtectedRoute>
      <CommunityPageShell view="suggestions" />
    </ProtectedRoute>
  );
}
