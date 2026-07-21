import type { Metadata } from "next";
import { NodeSeven } from "@/components/game/NodeSeven";

export const metadata: Metadata = {
  title: "node 07",
  description: "this endpoint was never meant to be public.",
  robots: { index: false, follow: false },
};

export default function GamePage() {
  return <NodeSeven />;
}
