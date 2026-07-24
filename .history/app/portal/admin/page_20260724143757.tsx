import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import AdminDashboard from "@/components/portal/AdminDashboard";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default function AdminPortalPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}
