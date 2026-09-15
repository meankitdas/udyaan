import type { Metadata } from "next";
import { SurveyApp } from "@/components/survey/SurveyApp";
import { problems } from "@/lib/problems";

export const metadata: Metadata = {
  title: "Student Assessment",
  description: "Show how you think, reason and approach real problems in the Udyaan student assessment.",
  robots: { index: false },
};

export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const { problem: slug } = await searchParams;
  const problem = problems.find(item => item.slug === slug);
  return <SurveyApp problemInterest={problem ? { id: problem.id, title: problem.title } : undefined} />;
}
