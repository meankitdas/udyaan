import type { Metadata } from "next";
import LoginClient from "@/components/portal/LoginClient";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return <LoginClient />;
}
