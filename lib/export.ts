"use client";

import type { SurveyForm, SurveyResponse } from "./survey";
import { formatDuration } from "./survey";

const CRITERIA_ORDER = [
  "farm_logic_accuracy",
  "practical_problem_solving",
  "strategic_decision_making",
  "learning_mindset",
  "initiative_and_program_fit",
  "engagement_and_completion",
  "timing_credibility",
] as const;

const CRITERIA_HEADERS: Record<string, string> = {
  farm_logic_accuracy: "Farm logic /30",
  practical_problem_solving: "Practical problem solving /20",
  strategic_decision_making: "Strategic decisions /15",
  learning_mindset: "Learning mindset /15",
  initiative_and_program_fit: "Initiative & fit /10",
  engagement_and_completion: "Engagement /5",
  timing_credibility: "Timing credibility /5",
};

const VERDICT_FILL: Record<string, string> = {
  shortlist: "FFE4EBD2",
  review: "FFF6E7C4",
  reject: "FFF3D9D2",
};

function cell(value: string | string[] | undefined): string {
  if (value == null) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}

/**
 * One row per candidate, one column per question, so the sheet can be sorted and
 * filtered the way a reviewer actually works. Columns are taken from the form
 * rather than from the responses: a question nobody answered still needs its
 * column, otherwise two exports of the same cohort would not line up.
 */
export async function exportCandidatesToExcel(form: SurveyForm, responses: SurveyResponse[]): Promise<void> {
  // Loaded on demand: the workbook writer is far larger than the rest of the
  // admin bundle and is only needed when someone actually clicks export.
  const ExcelJS = (await import("exceljs")).default;

  const questions = form.sections
    .flatMap((section) => section.questions)
    .filter((question) => question.type !== "statement");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Udyaan Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Candidates", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
  });

  const columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Verdict", key: "verdict", width: 12 },
    { header: "AI score /100", key: "aiScore", width: 13 },
    { header: "Cohort rank", key: "cohortRank", width: 12 },
    { header: "Percentile", key: "percentile", width: 11 },
    { header: "Quiz score", key: "quiz", width: 11 },
    { header: "Time taken", key: "duration", width: 12 },
    { header: "Submitted", key: "submittedAt", width: 20 },
    { header: "CV file", key: "cvFile", width: 26 },
    ...CRITERIA_ORDER.map((key) => ({ header: CRITERIA_HEADERS[key], key, width: 16 })),
    { header: "AI reasoning", key: "reasoning", width: 60 },
    { header: "Strengths", key: "strengths", width: 45 },
    { header: "Concerns", key: "concerns", width: 45 },
    { header: "Timing analysis", key: "timingAnalysis", width: 45 },
    ...questions.map((question) => ({
      header: question.label,
      key: `q_${question.id}`,
      width: question.type === "longtext" ? 55 : 26,
    })),
    { header: "Response ID", key: "id", width: 20 },
  ];
  sheet.columns = columns;

  for (const response of responses) {
    const evaluation = response.evaluation;
    const files = response.files ?? {};
    const attached = Object.values(files)[0];
    const row: Record<string, string | number> = {
      name: cell(response.answers["full_name"]) || "Anonymous",
      email: cell(response.answers["email"]),
      phone: cell(response.answers["phone"]),
      verdict: evaluation ? evaluation.verdict : "unscreened",
      aiScore: evaluation ? evaluation.score : "",
      cohortRank: evaluation?.cohortRank ?? "",
      percentile: evaluation?.cohortPercentile != null ? `top ${evaluation.cohortPercentile}%` : "",
      quiz:
        typeof response.score === "number" && response.maxScore
          ? `${response.score}/${response.maxScore}`
          : "",
      duration: formatDuration(response.totalMs),
      // A real date, not a string, so the column sorts and filters as one.
      submittedAt: response.submittedAt,
      cvFile: attached?.name ?? cell(response.answers["cv"]),
      reasoning: evaluation?.reasoning ?? "",
      strengths: (evaluation?.strengths ?? []).join("\n"),
      concerns: (evaluation?.concerns ?? []).join("\n"),
      timingAnalysis: evaluation?.timingAnalysis ?? "",
      id: response.id,
    };
    for (const key of CRITERIA_ORDER) {
      row[key] = evaluation?.criteria?.[key] ?? "";
    }
    for (const question of questions) {
      row[`q_${question.id}`] = cell(response.answers[question.id]);
    }

    const added = sheet.addRow(row);
    const submitted = new Date(response.submittedAt);
    if (!Number.isNaN(submitted.getTime())) {
      const dateCell = added.getCell("submittedAt");
      dateCell.value = submitted;
      dateCell.numFmt = "yyyy-mm-dd hh:mm";
    }
    const fill = evaluation ? VERDICT_FILL[evaluation.verdict] : undefined;
    if (fill) {
      added.getCell("verdict").fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
    added.alignment = { vertical: "top", wrapText: true };
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFF1EFE2" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF454E26" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `udyaan-candidates-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; one tick is
  // enough for the navigation to have started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
