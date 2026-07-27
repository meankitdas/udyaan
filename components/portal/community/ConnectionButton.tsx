"use client";

import { useState } from "react";
import { Check, Clock, UserCheck, UserPlus, X } from "lucide-react";
import {
  acceptConnection,
  declineConnection,
  removeConnection,
  requestConnection,
} from "@/lib/community-api";
import type { ConnectionState, ProfileSummary } from "@/lib/community-types";

type ConnectionButtonProps = {
  person: ProfileSummary;
  /** Called with the new state so parents can update lists without refetching. */
  onChange: (next: { connection_state: ConnectionState; connection_id?: string | null }) => void;
  size?: "sm" | "md";
};

/**
 * Drives the connect lifecycle: none -> pending -> connected.
 *
 * Connecting to a mentor needs their approval and connecting to a student does
 * not, so the label is set before the call ("Request mentorship" vs "Connect")
 * and the resulting state comes from the server's `auto_accepted` flag rather
 * than being guessed on the client.
 */
export default function ConnectionButton({
  person,
  onChange,
  size = "md",
}: ConnectionButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isMentor = person.community_role === "mentor";
  const cls = `community-btn ${size === "sm" ? "community-btn-sm" : ""}`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const result = await requestConnection(person.id);
      onChange({
        connection_state: result.auto_accepted ? "connected" : "pending_outgoing",
        connection_id: result.id,
      });
    });

  const accept = () =>
    run(async () => {
      if (!person.connection_id) return;
      await acceptConnection(person.connection_id);
      onChange({ connection_state: "connected", connection_id: person.connection_id });
    });

  const decline = () =>
    run(async () => {
      if (!person.connection_id) return;
      await declineConnection(person.connection_id);
      onChange({ connection_state: "none", connection_id: null });
    });

  const withdraw = () =>
    run(async () => {
      if (!person.connection_id) return;
      await removeConnection(person.connection_id);
      onChange({ connection_state: "none", connection_id: null });
    });

  return (
    <div className="community-connect">
      <div className="community-connect-actions">
        {person.connection_state === "none" && (
          <button type="button" className={`${cls} primary`} onClick={connect} disabled={busy}>
            <UserPlus size={15} strokeWidth={1.9} aria-hidden />
            {busy ? "Sending…" : isMentor ? "Request mentorship" : "Connect"}
          </button>
        )}

        {person.connection_state === "pending_outgoing" && (
          <button
            type="button"
            className={`${cls} ghost`}
            onClick={withdraw}
            disabled={busy}
            title="Withdraw your request"
          >
            <Clock size={15} strokeWidth={1.9} aria-hidden />
            {busy ? "Working…" : "Pending"}
          </button>
        )}

        {person.connection_state === "pending_incoming" && (
          <>
            <button type="button" className={`${cls} primary`} onClick={accept} disabled={busy}>
              <Check size={15} strokeWidth={2.1} aria-hidden /> Accept
            </button>
            <button type="button" className={`${cls} ghost`} onClick={decline} disabled={busy}>
              <X size={15} strokeWidth={2.1} aria-hidden /> Decline
            </button>
          </>
        )}

        {person.connection_state === "connected" && (
          <button
            type="button"
            className={`${cls} success`}
            onClick={withdraw}
            disabled={busy}
            title="Remove connection"
          >
            <UserCheck size={15} strokeWidth={1.9} aria-hidden />
            {busy ? "Working…" : "Connected"}
          </button>
        )}
      </div>

      {error && <p className="community-inline-error">{error}</p>}
    </div>
  );
}
