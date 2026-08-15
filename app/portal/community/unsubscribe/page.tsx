import { Suspense } from "react";
import type { Metadata } from "next";
import UnsubscribeClient from "@/components/portal/community/UnsubscribeClient";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeClient />
    </Suspense>
  );
}
