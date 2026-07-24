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

/** Normalize a fetch error message into something user-friendly. */
export function friendlyError(err: unknown): string {
  let message = err instanceof Error ? err.message : String(err);
  if (message === "Failed to fetch") {
    message = "Unable to connect to the server. Please check your internet connection or try again later.";
  } else if (message.includes("Unexpected token")) {
    message = "Server encountered an error. Please try again.";
  }
  return message;
}
