import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import OwnerDashboard from "@/components/portal/OwnerDashboard";

export const metadata: Metadata = { title: "Owner Console" };

export default function OwnerPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER"]}>
      <OwnerDashboard />
    </ProtectedRoute>
  );
}
