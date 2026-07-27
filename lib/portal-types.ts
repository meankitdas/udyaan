// Shared types for the ported role-based portal.

export type NavItem = { id: string; label: string };

export type Organization = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  organization_id?: string | null;
  role_key?: string;
  skills?: string | null;
};

export type PortalUser = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role_key?: string;
  organization_id?: string;
  is_approved?: boolean | null;
  created_at?: string;
};

export type Project = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  deadline?: string;
  created_by_name?: string;
  deliverables?: string;
  required_skills?: string;
  assignees_details?: Profile[];
};

export type ActionItem = {
  id: string;
  title: string;
  description?: string;
  urgency?: string;
  due_date?: string;
  status?: string;
  project_id?: string;
  assigned_to: string;
};

export type Meeting = {
  id: string;
  title: string;
  meeting_date: string;
  agenda?: string;
  attendees?: string;
  mom_content?: string;
};

// ---- Project management tool integrations ----

export type ProjectToolStatus = "Proposed" | "Approved" | "Declined";

export type ProjectTool = {
  id: string;
  project_id: string;
  tool_key: string;
  name: string;
  url?: string | null;
  purpose?: string | null;
  status: ProjectToolStatus;
  review_note?: string | null;
  proposed_by: string;
  proposed_by_name?: string | null;
  decided_by?: string | null;
  created_at?: string | null;
};

// ---- Community & insights ----

export type PeerMatch = {
  id: string;
  full_name: string;
  role_key?: string | null;
  shared_skills: string[];
  score: number;
};

export type ProjectMatch = {
  id: string;
  title: string;
  category?: string | null;
  status?: string | null;
  matched_skills: string[];
  score: number;
};

export type MatchesResponse = {
  my_skills: string[];
  peers: PeerMatch[];
  projects: ProjectMatch[];
};

export type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  role_key?: string | null;
  completed: number;
  total: number;
  points: number;
};

export type OrgInsights = {
  users_by_role: Record<string, number>;
  pending_approvals: number;
  projects_by_status: Record<string, number>;
  action_items_total: number;
  action_items_completed: number;
  action_items_overdue: number;
  upcoming_deadlines: { id: string; title: string; deadline: string; status?: string }[];
};

// ---- AI copilot ----

export type AiCitation = {
  kind: string;
  ref_id: string;
  title: string;
  score: number;
};

export type AiChatResponse = {
  answer: string;
  citations: AiCitation[];
  trace: { tool: string; args?: Record<string, unknown>; chars?: number }[];
  model: string;
};

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
  trace?: AiChatResponse["trace"];
};

export type AiStatus = {
  generation: string;
  model: string;
  retrieval: string;
  organization_id?: string | null;
};

export type ProjectBrief = {
  title?: string;
  category?: string;
  description?: string;
  project_type?: string;
  required_skills?: string;
  duration?: string;
  deliverables?: string;
  milestones?: { week?: string; goal?: string }[];
};

export type MeetingSummary = {
  summary?: string;
  decisions?: string[];
  action_items?: { title?: string; owner?: string; due_hint?: string; urgency?: string }[];
  risks?: string[];
};
