import type { Metadata, Viewport } from "next";
import HarvestGuard from "@/components/game/harvest-guard/HarvestGuard";

export const metadata: Metadata = {
  title: "Harvest Guard 3D",
  description:
    "A fullscreen agricultural physics puzzle. Grow vine defenses, route dangerous weather, collect seed packets, and protect the harvest.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#23683f",
};

export default function HarvestGuardPage() {
  return <HarvestGuard />;
}
