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
