import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Everything behind auth is disallowed: those pages render a login redirect, so
// crawling them burns budget and produces near-duplicate thin pages.
const PRIVATE_PATHS = [
  "/portal/",
  "/admin",
  "/secret",
  "/survey",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Answer engines: allowed explicitly so AI surfaces can cite Udyaan.
      { userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User"], allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: ["PerplexityBot", "ClaudeBot", "Claude-Web"], allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "Google-Extended", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
