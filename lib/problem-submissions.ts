export const PROBLEM_STATUSES = {
  new: "New",
  reviewing: "In review",
  contacted: "Contacted",
  accepted: "Accepted",
  declined: "Declined",
} as const;

export type ProblemStatus = keyof typeof PROBLEM_STATUSES;

export type ProblemBrief = {
  requestId: string;
  name: string;
  email: string;
  organisation: string;
  title: string;
  context: string;
  success: string;
  constraints: string;
  consent: true;
};

export type ProblemReceipt = { id: string; submittedAt: string };

export type ProblemSubmission = Omit<ProblemBrief, "requestId"> & ProblemReceipt & {
  status: ProblemStatus;
  notes: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  version: number;
};

export type ProblemPage = { items: ProblemSubmission[]; total: number; page: number; pageSize: number };
export type ProblemReview = Pick<ProblemSubmission, "status" | "notes" | "version">;