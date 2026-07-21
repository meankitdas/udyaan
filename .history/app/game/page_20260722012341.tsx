import type { Metadata } from "next";
import { OpenDrive } from "@/components/game/OpenDrive";

export const metadata: Metadata = {
  title: "jgi-fs02 / shared",
  description: "directory listing: ON. this server was supposed to be internal.",
  robots: { index: false, follow: false },
};

export default function GamePage() {
  return <OpenDrive />;
}
