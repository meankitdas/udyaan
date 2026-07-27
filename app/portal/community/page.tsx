import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "Community" };

export default function CommunityDirectoryPage() {
  return (
    <ProtectedRoute>
      <CommunityPageShell view="directory" />
    </ProtectedRoute>
  );
}
