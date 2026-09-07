import type { Metadata, Viewport } from "next";
import DroneGame from "@/components/game/drone-irrigation/DroneGame";

export const metadata: Metadata = {
  title: "Field Pilot | Drone Flight Simulator",
  description: "Fly from an agricultural drone's onboard camera with FPV and stabilized gimbal views, flight telemetry, and five irrigation assignments.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#203b2d",
};

export default function DroneIrrigationPage() {
  return <DroneGame />;
}