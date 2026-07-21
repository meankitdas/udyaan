import type { Metadata } from "next";
import { SurveyApp } from "@/components/survey/SurveyApp";

export const metadata: Metadata = {
  title: "Farm Logic Test",
  description: "Are you smarter than a 5th grader? Take the Udyaan farm logic test.",
  robots: { index: false },
};

export default function SurveyPage() {
  return <SurveyApp />;
}
