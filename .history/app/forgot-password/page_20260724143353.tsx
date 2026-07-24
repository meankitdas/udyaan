import type { Metadata } from "next";
import ForgotPasswordClient from "@/components/portal/ForgotPasswordClient";

export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
