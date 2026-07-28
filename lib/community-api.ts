// API client for the community network. Wraps the shared `apiFetch` so every
// call inherits the portal's token refresh and session-expiry handling.

import { API_BASE_URL, apiFetch } from "@/lib/portal-api";
import type {
  Achievement,
  AchievementInput,
  ConnectionActionResult,
  ConnectionItem,
  ConnectionRequests,
  DirectoryFacets,
  DirectoryFilters,
  DirectoryPage,
  ModerationAction,
  ModerationReport,
  ModerationSummary,
  ProfileDetail,
  ProfileUpdate,
  ReportReason,
  ReportTargetType,
  Tag,
} from "@/lib/community-types";
import type {
  Attachment,
  Comment,
  CommentPage,
  Conversation,
  ConversationPage,
  DirectMessage,
  FeedPage,
  FeedScope,
  LikeResult,
  MessageInput,
  MessagePage,
  Post,
  ReadResult,
  SyncResponse,
  UnreadSummary,
  DismissResult,
  SuggestionPage,
  PostInput,
  PostVisibility,
  UploadTicket,
} from "@/lib/community-types";

const BASE = `${API_BASE_URL}/community`;

/**
 * Unwrap a portal response, surfacing FastAPI's `detail` as the error message.
 * Without this every failure reads "Request failed", which hides the actual
 * reason (e.g. "You are already connected.") that the API took care to send.
 */
async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  let detail = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.detail) && body.detail[0]?.msg) detail = body.detail[0].msg;
  } catch {
    // Non-JSON error body; keep the status-based message.
  }
  throw new Error(detail);
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

// ---------------------------------------------------------------- tags

export async function searchTags(q: string, limit = 20): Promise<Tag[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q.trim()) params.set("q", q.trim());
  return unwrap(await apiFetch(`${BASE}/tags?${params}`));
}

export async function createTag(label: string): Promise<Tag> {
  return unwrap(await apiFetch(`${BASE}/tags`, jsonInit("POST", { label })));
}

// ------------------------------------------------------------- profiles

export async function getMyProfile(): Promise<ProfileDetail> {
  return unwrap(await apiFetch(`${BASE}/profiles/me`));
}

export async function getProfile(userId: string): Promise<ProfileDetail> {
  return unwrap(await apiFetch(`${BASE}/profiles/${encodeURIComponent(userId)}`));
}

export async function updateMyProfile(payload: ProfileUpdate): Promise<ProfileDetail> {
  return unwrap(await apiFetch(`${BASE}/profiles/me`, jsonInit("PUT", payload)));
}

export async function updateMyTags(tags: string[]): Promise<Tag[]> {
  return unwrap(await apiFetch(`${BASE}/profiles/me/tags`, jsonInit("PUT", { tags })));
}

export async function addAchievement(payload: AchievementInput): Promise<Achievement> {
  return unwrap(
    await apiFetch(`${BASE}/profiles/me/achievements`, jsonInit("POST", payload)),
  );
}

export async function updateAchievement(
  id: string,
  payload: Partial<AchievementInput>,
): Promise<Achievement> {
  return unwrap(
    await apiFetch(`${BASE}/profiles/me/achievements/${id}`, jsonInit("PUT", payload)),
  );
}

export async function deleteAchievement(id: string): Promise<void> {
  return unwrap(
    await apiFetch(`${BASE}/profiles/me/achievements/${id}`, jsonInit("DELETE")),
  );
}

// ------------------------------------------------------------ directory

export async function getDirectory(filters: DirectoryFilters): Promise<DirectoryPage> {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.tags?.length) params.set("tags", filters.tags.join(","));
  if (filters.university) params.set("university", filters.university);
  if (filters.organization_id) params.set("organization_id", filters.organization_id);
  if (filters.cohort) params.set("cohort", filters.cohort);
  if (filters.sort) params.set("sort", filters.sort);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.page_size ?? 24));

  return unwrap(await apiFetch(`${BASE}/directory?${params}`));
}

export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  return unwrap(await apiFetch(`${BASE}/directory/facets`));
}

// ---------------------------------------------------------- connections

export async function requestConnection(
  addresseeId: string,
  message?: string,
): Promise<ConnectionActionResult> {
  return unwrap(
    await apiFetch(
      `${BASE}/connections`,
      jsonInit("POST", { addressee_id: addresseeId, message: message || null }),
    ),
  );
}

export async function acceptConnection(id: string): Promise<ConnectionActionResult> {
  return unwrap(await apiFetch(`${BASE}/connections/${id}/accept`, jsonInit("POST")));
}

export async function declineConnection(id: string): Promise<ConnectionActionResult> {
  return unwrap(await apiFetch(`${BASE}/connections/${id}/decline`, jsonInit("POST")));
}

export async function removeConnection(id: string): Promise<void> {
  return unwrap(await apiFetch(`${BASE}/connections/${id}`, jsonInit("DELETE")));
}

export async function listConnections(
  status: "accepted" | "pending" | "all" = "accepted",
): Promise<ConnectionItem[]> {
  return unwrap(await apiFetch(`${BASE}/connections?status=${status}`));
}

export async function listRequests(): Promise<ConnectionRequests> {
  return unwrap(await apiFetch(`${BASE}/connections/requests`));
}

export async function followUser(userId: string): Promise<{ following: boolean }> {
  return unwrap(await apiFetch(`${BASE}/follows/${userId}`, jsonInit("POST")));
}

export async function unfollowUser(userId: string): Promise<{ following: boolean }> {
  return unwrap(await apiFetch(`${BASE}/follows/${userId}`, jsonInit("DELETE")));
}

// ---------------------------------------------------------- moderation

export async function reportTarget(payload: {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}): Promise<ModerationReport> {
  return unwrap(await apiFetch(`${BASE}/reports`, jsonInit("POST", payload)));
}

export async function listReports(status = "open"): Promise<ModerationReport[]> {
  return unwrap(await apiFetch(`${BASE}/moderation/reports?status=${status}`));
}

export async function getModerationSummary(): Promise<ModerationSummary> {
  return unwrap(await apiFetch(`${BASE}/moderation/summary`));
}

export async function resolveReport(
  id: string,
  action: ModerationAction,
  note?: string,
): Promise<ModerationReport> {
  return unwrap(
    await apiFetch(
      `${BASE}/moderation/reports/${id}/resolve`,
      jsonInit("POST", { action, note: note || null }),
    ),
  );
}

// ---------------------------------------------------------------- feed

export async function getFeed(options: {
  scope?: FeedScope;
  limit?: number;
  cursor?: string | null;
  tags?: string[];
}): Promise<FeedPage> {
  const params = new URLSearchParams();
  params.set("scope", options.scope ?? "for-you");
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);
  (options.tags ?? []).forEach((t) => params.append("tag", t));
  return unwrap(await apiFetch(`${BASE}/feed?${params}`));
}

export async function getUserPosts(
  userId: string,
  cursor?: string | null,
): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  return unwrap(await apiFetch(`${BASE}/profiles/${userId}/posts?${params}`));
}

export async function getPost(postId: string): Promise<Post> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}`));
}

export async function createPost(payload: PostInput): Promise<Post> {
  return unwrap(await apiFetch(`${BASE}/posts`, jsonInit("POST", payload)));
}

export async function updatePost(
  postId: string,
  payload: Partial<Pick<PostInput, "body" | "link_url" | "visibility" | "tags">>,
): Promise<Post> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}`, jsonInit("PATCH", payload)));
}

export async function deletePost(postId: string): Promise<void> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}`, { method: "DELETE" }));
}

export async function likePost(postId: string): Promise<LikeResult> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}/like`, { method: "POST" }));
}

export async function unlikePost(postId: string): Promise<LikeResult> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}/like`, { method: "DELETE" }));
}

export async function sharePost(
  postId: string,
  payload: { body?: string | null; visibility?: PostVisibility },
): Promise<Post> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}/share`, jsonInit("POST", payload)));
}

// ------------------------------------------------------------ comments

export async function listComments(postId: string): Promise<CommentPage> {
  return unwrap(await apiFetch(`${BASE}/posts/${postId}/comments`));
}

export async function createComment(
  postId: string,
  payload: { body: string; parent_id?: string | null },
): Promise<Comment> {
  return unwrap(
    await apiFetch(`${BASE}/posts/${postId}/comments`, jsonInit("POST", payload)),
  );
}

export async function updateComment(commentId: string, body: string): Promise<Comment> {
  return unwrap(await apiFetch(`${BASE}/comments/${commentId}`, jsonInit("PATCH", { body })));
}

export async function deleteComment(commentId: string): Promise<void> {
  return unwrap(await apiFetch(`${BASE}/comments/${commentId}`, { method: "DELETE" }));
}

// ------------------------------------------------------------- uploads

/**
 * Upload a file straight to cloud storage via a short-lived signed URL.
 *
 * The bytes never pass through the portal API. `headers` comes back from the
 * signing endpoint and is part of the signature, so it must be replayed
 * verbatim or storage rejects the request.
 */
export async function uploadAttachment(file: File): Promise<Attachment> {
  const ticket: UploadTicket = await unwrap(
    await apiFetch(
      `${BASE}/uploads/sign`,
      jsonInit("POST", {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
      }),
    ),
  );

  // Deliberately plain fetch, not apiFetch: this request goes to storage, and
  // attaching the portal's auth header would break the signature.
  const put = await fetch(ticket.upload_url, {
    method: ticket.method || "PUT",
    headers: ticket.headers,
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Please try again.`);
  }

  return {
    url: ticket.file_url,
    name: file.name,
    content_type: file.type || null,
    size: file.size,
  };
}

// ------------------------------------------------------------ messaging

export async function listConversations(options: {
  cursor?: string | null;
  includeArchived?: boolean;
} = {}): Promise<ConversationPage> {
  const params = new URLSearchParams({ limit: "30" });
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.includeArchived) params.set("include_archived", "true");
  return unwrap(await apiFetch(`${BASE}/conversations?${params}`));
}

export async function openConversation(userId: string): Promise<Conversation> {
  return unwrap(
    await apiFetch(`${BASE}/conversations`, jsonInit("POST", { user_id: userId })),
  );
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  return unwrap(await apiFetch(`${BASE}/conversations/${conversationId}`));
}

export async function updateConversation(
  conversationId: string,
  patch: { is_muted?: boolean; is_archived?: boolean },
): Promise<Conversation> {
  const params = new URLSearchParams();
  if (patch.is_muted !== undefined) params.set("is_muted", String(patch.is_muted));
  if (patch.is_archived !== undefined) {
    params.set("is_archived", String(patch.is_archived));
  }
  return unwrap(
    await apiFetch(`${BASE}/conversations/${conversationId}?${params}`, {
      method: "PATCH",
    }),
  );
}

export async function listMessages(
  conversationId: string,
  cursor?: string | null,
): Promise<MessagePage> {
  const params = new URLSearchParams({ limit: "40" });
  if (cursor) params.set("cursor", cursor);
  return unwrap(
    await apiFetch(`${BASE}/conversations/${conversationId}/messages?${params}`),
  );
}

export async function sendMessage(
  conversationId: string,
  payload: MessageInput,
): Promise<DirectMessage> {
  return unwrap(
    await apiFetch(
      `${BASE}/conversations/${conversationId}/messages`,
      jsonInit("POST", payload),
    ),
  );
}

export async function deleteMessage(messageId: string): Promise<void> {
  return unwrap(await apiFetch(`${BASE}/messages/${messageId}`, { method: "DELETE" }));
}

export async function markConversationRead(
  conversationId: string,
  until?: string | null,
): Promise<ReadResult> {
  return unwrap(
    await apiFetch(
      `${BASE}/conversations/${conversationId}/read`,
      jsonInit("POST", { until: until ?? null }),
    ),
  );
}

export async function getUnreadSummary(): Promise<UnreadSummary> {
  return unwrap(await apiFetch(`${BASE}/messages/unread`));
}

/** The transport seam. Swapping to SSE/WebSockets replaces only this call. */
export async function syncMessages(cursor?: string | null): Promise<SyncResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("since", cursor);
  return unwrap(await apiFetch(`${BASE}/messages/sync?${params}`));
}

// --------------------------------------------------------------------------
// Phase 4: suggestions

export async function listSuggestions(
  params: { limit?: number; offset?: number } = {},
): Promise<SuggestionPage> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  return unwrap(await apiFetch(`${BASE}/suggestions?${query}`));
}

export async function dismissSuggestion(userId: string): Promise<DismissResult> {
  return unwrap(
    await apiFetch(`${BASE}/suggestions/${userId}/dismiss`, jsonInit("POST", {})),
  );
}
