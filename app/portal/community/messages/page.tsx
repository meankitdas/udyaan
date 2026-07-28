import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import CommunityPageShell from "@/components/portal/community/CommunityPageShell";

export const metadata: Metadata = { title: "Messages" };

export default function CommunityMessagesPage() {
  return (
    <ProtectedRoute>
      <CommunityPageShell view="messages" />
    </ProtectedRoute>
  );
}
