// Types for the community network (profiles, directory, connections, moderation).
// Mirrors backend/app/portal/schemas/community.py.

export type CommunityRole = "student" | "mentor";

export type ConnectionState =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "connected";

export type ReportReason =
  | "spam"
  | "harassment"
  | "misinformation"
  | "inappropriate"
  | "other";

export type ReportTargetType = "user" | "post" | "comment";

export type Tag = {
  id: number;
  slug: string;
  label: string;
  category?: string | null;
  usage_count: number;
};

export type Achievement = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  issuer?: string | null;
  achieved_on?: string | null;
  url?: string | null;
  sort_order: number;
};

export type AchievementInput = {
  title: string;
  description?: string | null;
  issuer?: string | null;
  achieved_on?: string | null;
  url?: string | null;
  sort_order?: number;
};

export type ProfileSummary = {
  id: string;
  full_name: string;
  role_key?: string | null;
  community_role: CommunityRole;
  headline?: string | null;
  avatar_url?: string | null;
  university?: string | null;
  organization_name?: string | null;
  cohort?: string | null;
  tags: Tag[];
  connection_state: ConnectionState;
  connection_id?: string | null;
  is_following: boolean;
  shared_tags: string[];
  mutual_connections: number;
};

export type ProfileDetail = ProfileSummary & {
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  is_discoverable: boolean;
  achievements: Achievement[];
  connection_count: number;
  follower_count: number;
  following_count: number;
  is_self: boolean;
  created_at?: string | null;
};

export type ProfileUpdate = {
  full_name?: string;
  headline?: string | null;
  bio?: string | null;
  university?: string | null;
  cohort?: string | null;
  avatar_url?: string | null;
  is_discoverable?: boolean;
};

export type DirectoryFilters = {
  q?: string;
  role?: "" | CommunityRole;
  tags?: string[];
  university?: string;
  organization_id?: string;
  cohort?: string;
  sort?: "relevance" | "name" | "newest";
  page?: number;
  page_size?: number;
};

export type DirectoryPage = {
  results: ProfileSummary[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
};

export type DirectoryFacets = {
  universities: string[];
  cohorts: string[];
  organizations: { id: string; name: string }[];
  tags: Tag[];
};

export type ConnectionItem = {
  id: string;
  status: string;
  message?: string | null;
  created_at?: string | null;
  responded_at?: string | null;
  person: ProfileSummary;
  is_outgoing: boolean;
};

export type ConnectionRequests = {
  incoming: ConnectionItem[];
  outgoing: ConnectionItem[];
};

export type ConnectionActionResult = {
  id?: string | null;
  status: string;
  auto_accepted: boolean;
  message: string;
};

export type ModerationReport = {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string | null;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  created_at?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  reporter_id: string;
  reporter_name?: string | null;
  resolver_name?: string | null;
  target_label?: string | null;
};

export type ModerationAction = "dismiss" | "remove_content" | "deactivate_user";

export type ModerationSummary = {
  open: number;
  reviewing: number;
  actioned: number;
  dismissed: number;
};
