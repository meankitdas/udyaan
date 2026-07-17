import type { Metadata } from "next";
import { LoginForm } from "@/components/AuthForms";
import { AuthHeader, AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return <AuthShell><AuthHeader title="Welcome Back" subtitle="Sign in to continue to your dashboard" /><LoginForm /></AuthShell>;
}
