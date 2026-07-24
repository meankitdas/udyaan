"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { API_BASE_URL, authHeaders, clearSession } from "@/lib/portal-api";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", headers: authHeaders() });
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
