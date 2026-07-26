import type { Metadata } from "next";
import { SeedJourney } from "@/components/game/SeedJourney";

export const metadata: Metadata = {
  title: "Grow the secret",
  description: "An interactive Udyaan experience.",
  robots: { index: false, follow: false },
};

export default function SecretPage() {
  return <SeedJourney />;
}
