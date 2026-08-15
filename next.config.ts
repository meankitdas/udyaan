import type { NextConfig } from "next";

// Preview/testing hosts serve byte-identical HTML to the production domain.
// Left indexable they compete with www.udyaan.org and split ranking signals,
// so they are marked noindex at the edge while staying usable for testing.
const NON_CANONICAL_HOSTS = ["udyaan.vercel.app", "(?<sub>.*)\\.vercel\\.app"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      ...NON_CANONICAL_HOSTS.map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
