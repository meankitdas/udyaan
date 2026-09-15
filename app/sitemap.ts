import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { problems } from "@/lib/problems";

// Only publicly indexable pages belong here. Auth and portal routes are
// disallowed in robots.ts, and listing them would contradict that.
const ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/problems", priority: 0.9, changeFrequency: "weekly" },
  ...problems.map(problem => ({ path: `/problems/${problem.slug}`, priority: 0.8, changeFrequency: "monthly" as const })),
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/for-students", priority: 0.8, changeFrequency: "monthly" },
  { path: "/for-companies", priority: 0.8, changeFrequency: "monthly" },
  { path: "/ventures", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/living-lab", priority: 0.6, changeFrequency: "monthly" },
  { path: "/join", priority: 0.7, changeFrequency: "monthly" },
  { path: "/submit-problem", priority: 0.7, changeFrequency: "monthly" },
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
