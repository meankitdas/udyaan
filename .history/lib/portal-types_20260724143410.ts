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
};

export type PortalUser = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role_key?: string;
  organization_id?: string;
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
