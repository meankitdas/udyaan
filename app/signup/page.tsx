import type { Metadata } from "next";
import { SignupForm } from "@/components/AuthForms";
import { AuthHeader, AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Create Account" };

export default function SignupPage() {
  return <AuthShell><AuthHeader title="Create Account" subtitle="Join the Udyaan community today" /><SignupForm /></AuthShell>;
}
