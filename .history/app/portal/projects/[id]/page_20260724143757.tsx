import type { Metadata } from "next";
import ProtectedRoute from "@/components/portal/ProtectedRoute";
import ProjectDetails from "@/components/portal/ProjectDetails";

export const metadata: Metadata = { title: "Project Details" };

export default function ProjectDetailsPage() {
  return (
    <ProtectedRoute>
      <ProjectDetails />
    </ProtectedRoute>
  );
}
