import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/AuthForms";
import { AuthHeader, AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return <AuthShell><AuthHeader title="Forgot Password" subtitle="Enter your email to receive a reset link" /><ForgotPasswordForm /></AuthShell>;
}
