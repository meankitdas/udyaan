import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import SuperAdminDashboard from "@/components/portal/SuperAdminDashboard";

export const metadata: Metadata = { title: "Super Admin" };

export default function SuperAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
      <SuperAdminDashboard />
    </ProtectedRoute>
  );
}
