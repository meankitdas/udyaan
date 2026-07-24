"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { API_BASE_URL, authHeaders, clearSession } from "@/lib/portal-api";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // The backend revokes the refresh token, so it must be sent in the body.
      const refresh_token = window.sessionStorage.getItem("refresh_token");
      if (refresh_token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ refresh_token }),
        });
      }
    } catch {
      /* ignore network errors on logout */
    }
    clearSession();
    router.push("/login");
  };

  return (
    <button type="button" onClick={handleLogout} className="logout-btn">
      <LogOut size={16} strokeWidth={1.8} aria-hidden />
      Logout
    </button>
  );
}
