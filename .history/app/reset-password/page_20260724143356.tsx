import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordClient from "@/components/portal/ResetPasswordClient";

export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-wrapper" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
