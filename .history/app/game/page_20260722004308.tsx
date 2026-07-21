import type { Metadata } from "next";
import { HarvestSlash } from "@/components/game/HarvestSlash";

export const metadata: Metadata = {
  title: "Harvest Slash",
  description: "A three-round Udyaan field reflex challenge.",
  robots: { index: false },
};

export default function GamePage() {
  return <HarvestSlash />;
}
