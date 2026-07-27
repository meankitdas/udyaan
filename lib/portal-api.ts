// Shared API + auth helpers for the ported role-based portal (dashboards, auth flow).
// The portal is served by the main backend under the /portal prefix, so it shares
// the same base URL env var (NEXT_PUBLIC_UDYAAN_API) as the rest of the project.

const RAW_BASE = (process.env.NEXT_PUBLIC_UDYAAN_API ?? "http://localhost:8080").replace(/\/$/, "");
export const API_BASE_URL = `${RAW_BASE}/portal`;

export type RoleKey = "SUPERADMIN" | "ADMIN" | "STUDENT" | "FACULTY" | "PROJECT_HEAD";

/** Where each role lands after logging in. */
export const roleHome: Record<string, string> = {
  SUPERADMIN: "/portal/superadmin",
  ADMIN: "/portal/admin",
  STUDENT: "/portal/student",
  FACULTY: "/portal/faculty",
  PROJECT_HEAD: "/portal/project-head",
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("access_token");
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("role_key");
}

export function setSession(tokens: { access_token: string; refresh_token?: string; role_key?: string }) {
  if (typeof window === "undefined") return;
  sessionEnded = false;
  window.sessionStorage.setItem("access_token", tokens.access_token);
  if (tokens.refresh_token) window.sessionStorage.setItem("refresh_token", tokens.refresh_token);
  if (tokens.role_key) window.sessionStorage.setItem("role_key", tokens.role_key);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem("access_token");
  window.sessionStorage.removeItem("refresh_token");
  window.sessionStorage.removeItem("role_key");
}

/** Authorization header for authenticated requests. */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Set once the session is beyond recovery. Every request in flight at that
 * moment fails, and each caller would otherwise report it as its own feature
 * breaking ("Could not load the project's results chain") while the redirect to
 * login is still being processed. This lets `friendlyError` name the real cause.
 */
let sessionEnded = false;

/** Normalize a fetch error message into something user-friendly. */
export function friendlyError(err: unknown): string {
  if (sessionEnded) {
    return "Your session expired. Please sign in again to continue.";
  }
  let message = err instanceof Error ? err.message : String(err);
  if (message === "Failed to fetch") {
    message = "Unable to connect to the server. Please check your internet connection or try again later.";
  } else if (message.includes("Unexpected token")) {
    message = "Server encountered an error. Please try again.";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Session lifecycle
//
// Access tokens are short-lived (30 min). Without this, every session started
// failing with "Could not validate credentials" once the token aged out. We now
// transparently refresh using the rotating refresh token and retry the request.
// ---------------------------------------------------------------------------

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("refresh_token");
}

/** In-flight refresh, shared so concurrent 401s only trigger one refresh. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.access_token) return false;
        // The refresh response has no role, so preserve the one we already hold.
        setSession({ ...data, role_key: getRole() ?? undefined });
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/** Send the user back to login once the session can't be recovered. */
function endSession() {
  sessionEnded = true;
  clearSession();
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (pathname.startsWith("/login")) return;
  const next = encodeURIComponent(`${pathname}${search}`);
  window.location.replace(`/login?expired=1&next=${next}`);
}

/**
 * Authenticated fetch: attaches the bearer token, transparently refreshes an
 * expired access token once, retries, and only then gives up and re-authenticates.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const build = (): RequestInit => ({
    ...init,
    headers: { ...((init.headers as Record<string, string>) ?? {}), ...authHeaders() },
  });

  let res = await fetch(input, build());
  if (res.status !== 401) return res;

  // 401: try exactly one silent refresh, then replay the original request.
  if (await refreshSession()) {
    res = await fetch(input, build());
    if (res.status !== 401) return res;
  }

  endSession();
  return res;
}
