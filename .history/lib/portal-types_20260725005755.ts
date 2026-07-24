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
