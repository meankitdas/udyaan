import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyOtpForm } from "@/components/AuthForms";
import { AuthHeader, AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Verify Your Email" };

export default function VerifyOtpPage() {
  return (
    <AuthShell>
      <AuthHeader title="Verify Your Email" subtitle="Preview the 6-digit email verification step" />
      <Suspense fallback={<p className="centered">Loading verification form...</p>}><VerifyOtpForm /></Suspense>
    </AuthShell>
  );
}
