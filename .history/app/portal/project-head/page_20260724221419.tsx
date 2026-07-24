import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import ProjectHeadDashboard from "@/components/portal/ProjectHeadDashboard";

export const metadata: Metadata = { title: "Project Head Dashboard" };

export default function ProjectHeadPage() {
  return (
    <ProtectedRoute allowedRoles={["PROJECT_HEAD"]}>
      <ProjectHeadDashboard />
    </ProtectedRoute>
  );
}
