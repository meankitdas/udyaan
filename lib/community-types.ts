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

export type ReportTargetType = "user" | "post" | "comment" | "message";

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

// ---------------------------------------------------------------- feed

export type PostType = "update" | "research" | "achievement";
export type PostVisibility = "public" | "connections";
export type FeedScope = "for-you" | "following" | "latest";

export interface Attachment {
  url: string;
  name?: string | null;
  content_type?: string | null;
  size?: number | null;
}

export interface PostAchievement {
  id: string;
  title: string;
  issuer?: string | null;
  description?: string | null;
  url?: string | null;
}

export interface Post {
  id: string;
  post_type: PostType;
  body?: string | null;
  link_url?: string | null;
  attachment?: Attachment | null;
  achievement?: PostAchievement | null;
  visibility: PostVisibility;
  tags: Tag[];
  author?: ProfileSummary | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  viewer_has_liked: boolean;
  can_edit: boolean;
  can_moderate: boolean;
  shared_from?: Post | null;
  shared_source_missing: boolean;
  is_removed: boolean;
  created_at?: string | null;
  edited_at?: string | null;
  /** Only present on the "for-you" feed; used for the relevance hint. */
  score?: number | null;
  matched_tags: string[];
}

export interface FeedPage {
  items: Post[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface PostInput {
  post_type: PostType;
  body?: string | null;
  link_url?: string | null;
  attachment?: Attachment | null;
  achievement_id?: string | null;
  visibility: PostVisibility;
  tags: string[];
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id?: string | null;
  body: string;
  author?: ProfileSummary | null;
  can_edit: boolean;
  can_moderate: boolean;
  is_removed: boolean;
  created_at?: string | null;
  edited_at?: string | null;
  replies: Comment[];
}

export interface CommentPage {
  items: Comment[];
  total: number;
}

export interface LikeResult {
  post_id: string;
  viewer_has_liked: boolean;
  like_count: number;
}

export interface UploadTicket {
  upload_url: string;
  file_url: string;
  object_key: string;
  method: string;
  fields: Record<string, string>;
  headers: Record<string, string>;
  max_bytes: number;
  expires_at: string;
}

// -------------------------------------------------------------- messaging

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body?: string | null;
  attachment?: Attachment | null;
  is_mine: boolean;
  is_removed: boolean;
  can_delete: boolean;
  created_at?: string | null;
  edited_at?: string | null;
  /** Client-only: set on optimistic bubbles that have not been confirmed yet. */
  pending?: boolean;
  failed?: boolean;
}

export interface MessagePage {
  items: DirectMessage[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface Conversation {
  id: string;
  other?: ProfileSummary | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  last_message_is_mine: boolean;
  unread_count: number;
  is_muted: boolean;
  is_archived: boolean;
  created_at?: string | null;
}

export interface ConversationPage {
  items: Conversation[];
  next_cursor?: string | null;
  has_more: boolean;
  total_unread: number;
}

export interface MessageInput {
  body?: string | null;
  attachment?: Attachment | null;
  client_token?: string | null;
}

export interface ReadResult {
  conversation_id: string;
  unread_count: number;
  total_unread: number;
}

/**
 * A change set, not a snapshot. Polling produces it today; a socket would
 * deliver the identical payload, so the client reducer is transport-agnostic.
 */
export interface SyncResponse {
  cursor: string;
  server_time: string;
  messages: DirectMessage[];
  conversations: Conversation[];
  total_unread: number;
}

export interface UnreadSummary {
  total_unread: number;
  conversation_count: number;
}

// --------------------------------------------------------------------------
// Phase 4: suggestions

/**
 * One page of "people you may know".
 *
 * Results are plain `ProfileSummary` values, so a suggestion renders through
 * the same card as a directory result. `personalized` reports whether embedding
 * similarity contributed to the ranking; when false the list is still ordered,
 * just by mutuals, shared tags and cohort alone.
 */
export interface SuggestionPage {
  results: ProfileSummary[];
  has_more: boolean;
  personalized: boolean;
}

export interface DismissResult {
  dismissed: boolean;
  user_id: string;
}

export interface BackfillResult {
  posts_embedded: number;
  users_embedded: number;
  vector_search_enabled: boolean;
}
