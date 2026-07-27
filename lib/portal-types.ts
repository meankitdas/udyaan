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

export type DependencyEdge = {
  id: string;
  action_id: string;
  depends_on_id: string;
};

export type DependencyNode = {
  id: string;
  title: string;
  status: string;
  urgency: string;
  due_date: string;
  assigned_to: string;
  assigned_to_name?: string | null;
  prerequisite_ids: string[];
  dependent_ids: string[];
  unresolved_prerequisites: number;
  blocked: boolean;
  overdue: boolean;
  ready: boolean;
  on_critical_path: boolean;
};

export type DependencyGraph = {
  project_id: string;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  blocked_count: number;
  ready_count: number;
  overdue_count: number;
  critical_path: string[];
};

export type Meeting = {
  id: string;
  title: string;
  meeting_date: string;
  agenda?: string;
  attendees?: string;
  mom_content?: string;
};

// ---- Results chain (inputs -> process -> outputs -> outcomes -> impact) ----

export type ImpactStage = "inputs" | "process" | "outputs" | "outcomes" | "impact";

export type ImpactEntry = {
  id: string;
  project_id: string;
  stage: ImpactStage;
  title: string;
  description?: string | null;
  metric_name?: string | null;
  metric_unit?: string | null;
  baseline_value?: number | null;
  metric_value?: number | null;
  target_value?: number | null;
  recorded_by: string;
  recorded_by_name?: string | null;
  progress?: number | null;
  created_at?: string | null;
};

export type ImpactStageSummary = {
  stage: ImpactStage;
  entries: number;
  measured: number;
  average_progress?: number | null;
};

export type ImpactOverview = {
  project_id: string;
  stages: ImpactStageSummary[];
  total_entries: number;
  chain_completeness: number;
  entries: ImpactEntry[];
};

// ---- Weekly records + dashboard ----

export type UpdateStatus = "on_track" | "at_risk" | "blocked" | "completed";

/** How the dashboard reads its numbers: frozen at week close, or as of now. */
export type PulseMode = "weekly" | "live";

export type WeeklyUpdate = {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  iso_year: number;
  iso_week: number;
  label: string;
  status: UpdateStatus;
  headline: string;
  progress_note?: string | null;
  blockers?: string | null;
  next_steps?: string | null;
  completion_percent?: number | null;
  submitted_by: string;
  submitted_by_name?: string | null;
  submitted_late: boolean;
  created_at?: string | null;
};

export type CadenceStatus = {
  period_start: string;
  period_end: string;
  label: string;
  due_at: string;
  reported: boolean;
  current?: WeeklyUpdate | null;
  streak_weeks: number;
  weeks_tracked: number;
  weeks_reported: number;
  missed_weeks: string[];
  on_time_rate: number;
};

export type LiveCounters = {
  meetings_total: number;
  meetings_this_week: number;
  actions_open: number;
  actions_overdue: number;
  actions_completed: number;
  action_completion_rate: number;
  impact_entries: number;
  tools_connected: number;
};

export type ProjectPulse = {
  project_id: string;
  project_title?: string | null;
  mode: PulseMode;
  generated_at: string;
  as_of: string;
  stale: boolean;
  cadence: CadenceStatus;
  counters: LiveCounters;
  recent_updates: WeeklyUpdate[];
};

export type DigestRow = {
  project_id: string;
  title?: string | null;
  reported: boolean;
  status?: UpdateStatus | null;
  headline?: string | null;
  completion_percent?: number | null;
  streak_weeks: number;
};

export type WeeklyDigest = {
  period_start: string;
  period_end: string;
  label: string;
  projects_total: number;
  projects_reported: number;
  reporting_rate: number;
  at_risk: number;
  blocked: number;
  rows: DigestRow[];
};

// ---- AI advisor ----

export type PillarKey = "innovation" | "operations" | "delight";

export type AiRecommendation = {
  title: string;
  why: string;
  first_step: string;
  effort: string;
  impact: string;
};

export type AiPillar = {
  key: PillarKey;
  label: string;
  score: number;
  headline: string;
  findings: string[];
  recommendations: AiRecommendation[];
};

export type AdvisorReport = {
  project_id: string;
  project_title?: string | null;
  generated_at: string;
  model: string;
  health_score: number;
  health_summary: string;
  pillars: AiPillar[];
  evidence: Record<string, Record<string, unknown>>;
};

export type WeeklyDraft = {
  status: UpdateStatus;
  headline: string;
  progress_note: string;
  blockers?: string | null;
  next_steps?: string | null;
  completion_percent?: number | null;
  grounded_in: Record<string, number>;
};

// ---- Reports ----

export type ReportDetail = {
  id: string;
  title: string;
  content: string;
  project_id: string;
  project_title?: string | null;
  submitted_by: string;
  submitted_by_name?: string | null;
  submitted_to: string;
  submitted_to_name?: string | null;
  created_at: string;
};

// ---- Control centre ----

export type ControlMetric = {
  key: string;
  label: string;
  value: number;
  delta?: number | null;
  unit?: string | null;
  spark: number[];
};

export type ControlSeriesPoint = {
  label: string;
  projects: number;
  updates: number;
  meetings: number;
  actions: number;
};

export type ControlSlice = { name: string; value: number };

export type DirectoryRow = {
  kind: "project" | "person" | "organisation";
  id: string;
  name: string;
  subtitle?: string | null;
  status?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  role?: string | null;
  created_at?: string | null;
  approved?: boolean | null;
};

export type ControlFeedItem = {
  kind: string;
  title: string;
  detail?: string | null;
  project_id?: string | null;
  at?: string | null;
};

export type ControlCentre = {
  scope: "platform" | "organization";
  organization_id?: string | null;
  organization_name?: string | null;
  generated_at: string;
  metrics: ControlMetric[];
  series: ControlSeriesPoint[];
  project_status: ControlSlice[];
  role_mix: ControlSlice[];
  update_status: ControlSlice[];
  directory: DirectoryRow[];
  feed: ControlFeedItem[];
  pending_approvals: number;
};

// ---- Digital Maturity Index ----

export type MaturityLevel = {
  level: number;
  label: string;
  from: number;
  to: number;
  description: string;
};

export type MaturityFramework = {
  version: string;
  name: string;
  summary: string;
  levels: MaturityLevel[];
  dimensions: { key: string; label: string; weight: number; question: string; why: string }[];
};

export type MaturityDimension = {
  key: string;
  label: string;
  weight: number;
  applicable: boolean;
  score?: number | null;
  level?: number | null;
  level_label?: string | null;
  signals: Record<string, number>;
};

export type MaturityResult = {
  organization_id: string;
  organization_name?: string | null;
  framework_version: string;
  composite_score: number;
  level: number;
  level_label: string;
  level_description: string;
  coverage: number;
  dimensions: MaturityDimension[];
  evidence: Record<string, number>;
  generated_at: string;
};

export type MaturitySnapshot = {
  id: string;
  organization_id: string;
  framework_version: string;
  composite_score: number;
  level: number;
  dimensions: MaturityDimension[];
  captured_by?: string | null;
  created_at?: string | null;
};

export type MaturityBenchmark = {
  framework_version: string;
  organizations: number;
  cohort_average?: number | null;
  your_score?: number | null;
  your_percentile?: number | null;
  dimensions: { key: string; label: string; cohort_average?: number | null; organizations_scored: number }[];
  leaderboard: {
    organization_id: string;
    organization_name?: string | null;
    composite_score: number;
    level: number;
    coverage: number;
  }[];
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
