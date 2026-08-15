"use client";

import Script from "next/script";

// GA4 + Google Ads. Both are optional: with no env vars set nothing is injected,
// so local and preview builds stay clean and no consent banner is triggered.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

export function Analytics() {
  const ids = [GA_ID, ADS_ID].filter(Boolean) as string[];
  if (ids.length === 0) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${ids.map((id) => `gtag('config', '${id}');`).join("\n          ")}
        `}
      </Script>
    </>
  );
}

type ConversionArgs = { label?: string; value?: number; currency?: string };

/**
 * Report a conversion (application started, signup completed, ...). Safe to call
 * when analytics is not configured — it simply does nothing.
 */
export function trackConversion(name: string, { label, value, currency = "INR" }: ConversionArgs = {}) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;

  gtag("event", name, { value, currency });
  if (ADS_ID && label) {
    gtag("event", "conversion", { send_to: `${ADS_ID}/${label}`, value, currency });
  }
}
