import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Only publicly indexable pages belong here. Auth and portal routes are
// disallowed in robots.ts, and listing them would contradict that.
const ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: absoluteUrl(path || "/"),
    lastModified,
    changeFrequency,
    priority,
  }));
}
