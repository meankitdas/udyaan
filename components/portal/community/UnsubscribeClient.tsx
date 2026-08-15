"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/portal-api";

type State = "working" | "done" | "error";

export default function UnsubscribeClient() {
  const params = useSearchParams();
  const [state, setState] = useState<State>("working");
  const [message, setMessage] = useState("");

  const user = params.get("u");
  const token = params.get("t");

  useEffect(() => {
    if (!user || !token) {
      setState("error");
      setMessage("This unsubscribe link is incomplete.");
      return;
    }

    // Unauthenticated on purpose: the signature in the link is the proof, so a
    // recipient can opt out without having to log in first.
    fetch(
      `${API_BASE_URL}/notifications/unsubscribe?u=${encodeURIComponent(user)}&t=${encodeURIComponent(token)}`,
      { method: "POST" },
    )
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail ?? "That link is no longer valid.");
        }
        setState("done");
      })
      .catch((err) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      });
  }, [user, token]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Email notifications</h2>
        </div>

        {state === "working" && <p>Updating your preferences…</p>}

        {state === "done" && (
          <>
            <div className="alert alert-success">
              You have been unsubscribed from Udyaan notification emails.
            </div>
            <p style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
              You will still see everything in the portal, and you can turn these
              emails back on any time from your community settings.
            </p>
          </>
        )}

        {state === "error" && <div className="alert alert-error">{message}</div>}

        <p style={{ marginTop: "18px" }}>
          <Link href="/portal/community">Back to the community</Link>
        </p>
      </div>
    </div>
  );
}
