"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Inbox, Send, UserCheck, X } from "lucide-react";
import Avatar from "./Avatar";
import PortalSkeleton from "../PortalSkeleton";
import {
  acceptConnection,
  declineConnection,
  listConnections,
  listRequests,
  removeConnection,
} from "@/lib/community-api";
import type { ConnectionItem, ConnectionRequests } from "@/lib/community-types";

type RequestsInboxProps = {
  onOpenProfile: (userId: string) => void;
  onCountChange?: (pendingIncoming: number) => void;
};

type Panel = "incoming" | "outgoing" | "connections";

export default function RequestsInbox({
  onOpenProfile,
  onCountChange,
}: RequestsInboxProps) {
  const [requests, setRequests] = useState<ConnectionRequests>({ incoming: [], outgoing: [] });
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [panel, setPanel] = useState<Panel>("incoming");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqs, conns] = await Promise.all([listRequests(), listConnections("accepted")]);
      setRequests(reqs);
      setConnections(conns);
      onCountChange?.(reqs.incoming.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your requests");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (item: ConnectionItem, action: "accept" | "decline" | "withdraw") => {
    setBusyId(item.id);
    setError("");
    try {
      if (action === "accept") {
        await acceptConnection(item.id);
        setRequests((r) => ({
          ...r,
          incoming: r.incoming.filter((c) => c.id !== item.id),
        }));
        setConnections((c) => [{ ...item, status: "accepted" }, ...c]);
        onCountChange?.(requests.incoming.length - 1);
      } else if (action === "decline") {
        await declineConnection(item.id);
        setRequests((r) => ({
          ...r,
          incoming: r.incoming.filter((c) => c.id !== item.id),
        }));
        onCountChange?.(requests.incoming.length - 1);
      } else {
        await removeConnection(item.id);
        setRequests((r) => ({
          ...r,
          outgoing: r.outgoing.filter((c) => c.id !== item.id),
        }));
        setConnections((c) => c.filter((x) => x.id !== item.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete that action");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PortalSkeleton variant="dashboard" />;

  const panels: { id: Panel; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "incoming", label: "Requests", icon: Inbox, count: requests.incoming.length },
    { id: "outgoing", label: "Sent", icon: Send, count: requests.outgoing.length },
    { id: "connections", label: "Connections", icon: UserCheck, count: connections.length },
  ];

  const items =
    panel === "incoming"
      ? requests.incoming
      : panel === "outgoing"
        ? requests.outgoing
        : connections;

  const emptyCopy: Record<Panel, string> = {
    incoming: "No one is waiting on you right now. Requests you receive will show up here.",
    outgoing: "You haven't sent any requests that are still pending.",
    connections: "You're not connected with anyone yet — the directory is a good place to start.",
  };

  return (
    <div className="community-inbox">
      <div className="community-tabs" role="tablist">
        {panels.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={panel === p.id}
              className={panel === p.id ? "active" : ""}
              onClick={() => setPanel(p.id)}
            >
              <Icon size={15} strokeWidth={1.9} aria-hidden />
              {p.label}
              {p.count > 0 && <span className="community-tab-count">{p.count}</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="community-inline-error">{error}</p>}

      {items.length === 0 ? (
        <div className="community-empty">
          <Inbox size={28} strokeWidth={1.4} aria-hidden />
          <p>{emptyCopy[panel]}</p>
        </div>
      ) : (
        <ul className="community-request-list">
          {items.map((item) => (
            <li key={item.id} className="table-card community-request">
              <button
                type="button"
                className="community-request-person"
                onClick={() => onOpenProfile(item.person.id)}
              >
                <Avatar
                  name={item.person.full_name}
                  src={item.person.avatar_url}
                  size={44}
                />
                <span>
                  <strong>{item.person.full_name}</strong>
                  <span className={`community-role-badge ${item.person.community_role}`}>
                    {item.person.community_role === "mentor" ? "Mentor" : "Student"}
                  </span>
                  {item.person.headline && <small>{item.person.headline}</small>}
                </span>
              </button>

              {item.message && <p className="community-request-message">“{item.message}”</p>}

              <div className="community-request-actions">
                {panel === "incoming" && (
                  <>
                    <button
                      type="button"
                      className="community-btn community-btn-sm primary"
                      onClick={() => act(item, "accept")}
                      disabled={busyId === item.id}
                    >
                      <Check size={15} strokeWidth={2.1} aria-hidden /> Accept
                    </button>
                    <button
                      type="button"
                      className="community-btn community-btn-sm ghost"
                      onClick={() => act(item, "decline")}
                      disabled={busyId === item.id}
                    >
                      <X size={15} strokeWidth={2.1} aria-hidden /> Decline
                    </button>
                  </>
                )}

                {panel === "outgoing" && (
                  <button
                    type="button"
                    className="community-btn community-btn-sm ghost"
                    onClick={() => act(item, "withdraw")}
                    disabled={busyId === item.id}
                  >
                    <Clock size={15} strokeWidth={1.9} aria-hidden /> Withdraw
                  </button>
                )}

                {panel === "connections" && (
                  <button
                    type="button"
                    className="community-btn community-btn-sm ghost"
                    onClick={() => act(item, "withdraw")}
                    disabled={busyId === item.id}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
