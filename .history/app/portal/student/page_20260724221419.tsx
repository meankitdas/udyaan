import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import StudentDashboard from "@/components/portal/StudentDashboard";

export const metadata: Metadata = { title: "Student Dashboard" };

export default function StudentPage() {
  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <StudentDashboard />
    </ProtectedRoute>
  );
}
