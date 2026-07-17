import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.udyaan.org";
  return ["", "/contact", "/terms", "/privacy", "/login", "/signup", "/forgot-password"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date("2026-07-15"),
    changeFrequency: path === "" ? "weekly" as const : "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
