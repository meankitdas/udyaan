"use client";

import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/portal-api";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="logout-btn"
      style={{
        marginTop: "auto",
        padding: "10px",
        backgroundColor: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        width: "100%",
      }}
    >
      Logout
    </button>
  );
}
