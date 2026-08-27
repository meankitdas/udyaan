export type QuestionType =
  | "statement"
  | "text"
  | "longtext"
  | "email"
  | "phone"
  | "select"
  | "choice"
  | "multichoice"
  | "file";

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  correctOption?: string;
  points?: number;
  image?: string;
};

export type SurveySection = {
  id: string;
  title: string;
  heading: string;
  subheading?: string;
  icon: string;
  questions: Question[];
};

export type SurveyForm = {
  id: string;
  title: string;
  subtitle: string;
  published: boolean;
  collectEmails: boolean;
  updatedAt: string;
  sections: SurveySection[];
};

export type AnswerValue = string | string[];

/**
 * A file a candidate attached to one question (currently the CV).
 *
 * The answer value keeps the filename so the text stays readable in the answer
 * list and the screening prompt; this carries the pointer to the stored bytes.
 */
export type ResponseFile = {
  name: string;
  size: number;
  contentType: string;
  objectKey: string;
  uploadedAt: string;
};

export type QuestionTiming = {
  questionId: string;
  activeMs: number;
  visits: number;
  changes: number;
};

export type SurveyResponse = {
  id: string;
  formId: string;
  answers: Record<string, AnswerValue>;
  files?: Record<string, ResponseFile>;
  timings: QuestionTiming[];
  startedAt: string;
  submittedAt: string;
  totalMs: number;
  score?: number;
  maxScore?: number;
  evaluation?: Evaluation;
};

export type Evaluation = {
  verdict: "shortlist" | "review" | "reject";
  score: number;
  reasoning: string;
  criteria?: Record<string, number>;
  strengths: string[];
  concerns: string[];
  timingAnalysis: string;
  cohortRank?: number;
  cohortSize?: number;
  cohortPercentile?: number;
  evaluatedAt: string;
  model: string;
};

export function computeQuizScore(form: SurveyForm, answers: Record<string, AnswerValue>) {
  let score = 0;
  let maxScore = 0;
  for (const section of form.sections) {
    for (const q of section.questions) {
      if (q.correctOption == null) continue;
      const points = q.points ?? 1;
      maxScore += points;
      if (answers[q.id] === q.correctOption) score += points;
    }
  }
  return { score, maxScore };
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function uid(prefix = "q") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
