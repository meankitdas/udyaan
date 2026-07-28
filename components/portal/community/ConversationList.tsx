"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import Avatar from "./Avatar";
import type { Conversation } from "@/lib/community-types";

type ConversationListProps = {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (conversation: Conversation) => void;
};

function timeLabel(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  if (mins < 10080) return `${Math.round(mins / 1440)}d`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ConversationList({
  conversations,
  activeId,
  loading,
  onSelect,
}: ConversationListProps) {
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const visible = term
    ? conversations.filter((c) =>
        (c.other?.full_name ?? "").toLowerCase().includes(term),
      )
    : conversations;

  return (
    <div className="community-msg-list">
      <div className="community-msg-search">
        <Search size={15} strokeWidth={2} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
        />
      </div>

      {loading && conversations.length === 0 ? (
        <p className="community-muted community-msg-hint">Loading conversations…</p>
      ) : visible.length === 0 ? (
        <p className="community-muted community-msg-hint">
          {term
            ? "No conversations match that name."
            : "No conversations yet. Open someone's profile and choose Message to start one."}
        </p>
      ) : (
        <ul className="community-msg-items">
          {visible.map((conversation) => {
            const other = conversation.other;
            const unread = conversation.unread_count > 0;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={`community-msg-item${
                    conversation.id === activeId ? " active" : ""
                  }${unread ? " unread" : ""}`}
                  onClick={() => onSelect(conversation)}
                  aria-current={conversation.id === activeId ? "true" : undefined}
                >
                  <Avatar
                    name={other?.full_name ?? "Member"}
                    src={other?.avatar_url}
                    size={42}
                    role={other?.community_role}
                  />
                  <span className="community-msg-item-main">
                    <span className="community-msg-item-top">
                      <strong>{other?.full_name ?? "Member"}</strong>
                      <small>{timeLabel(conversation.last_message_at)}</small>
                    </span>
                    <span className="community-msg-item-preview">
                      {conversation.last_message_is_mine && (
                        <span className="community-msg-you">You: </span>
                      )}
                      {conversation.last_message_preview ?? "No messages yet"}
                    </span>
                  </span>
                  {unread && (
                    <span className="community-msg-badge">
                      {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
