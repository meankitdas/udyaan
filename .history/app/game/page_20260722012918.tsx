import type { Metadata } from "next";
import { RemoteArchive } from "@/components/game/RemoteArchive";

export const metadata: Metadata = {
  title: "Remote Desktop Connection",
  description: "Interactive fiction: a fictional remote archive session.",
  robots: { index: false, follow: false },
};

export default function GamePage() {
  return <RemoteArchive />;
}
