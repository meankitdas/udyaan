"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRole, getToken } from "@/lib/portal-api";

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const role = getRole();
      if (!role || !allowedRoles.includes(role)) {
        router.replace("/");
        return;
      }
    }

    setAuthorized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authorized) return null;
  return <>{children}</>;
}
