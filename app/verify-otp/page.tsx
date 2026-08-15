import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyOtpClient from "@/components/portal/VerifyOtpClient";

export const metadata: Metadata = { title: "Verify Your Email", robots: { index: false, follow: false } };

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="auth-wrapper" />}>
      <VerifyOtpClient />
    </Suspense>
  );
}
