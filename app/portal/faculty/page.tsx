import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import FacultyDashboard from "@/components/portal/FacultyDashboard";

export const metadata: Metadata = { title: "Faculty Dashboard" };

export default function FacultyPage() {
  return (
    <ProtectedRoute allowedRoles={["FACULTY"]}>
      <FacultyDashboard />
    </ProtectedRoute>
  );
}
