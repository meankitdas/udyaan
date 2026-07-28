"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, BellOff, Flag, MoreHorizontal, Trash2 } from "lucide-react";
import Avatar from "./Avatar";
import MessageComposer from "./MessageComposer";
import ReportDialog from "./ReportDialog";
import ResearchAttachment from "./ResearchAttachment";
import { deleteMessage, listMessages } from "@/lib/community-api";
import type { Attachment, Conversation, DirectMessage } from "@/lib/community-types";

type MessageThreadProps = {
  conversation: Conversation;
  messages: DirectMessage[];
  onLoadedOlder: (older: DirectMessage[]) => void;
  onSend: (body: string, attachment: Attachment | null) => Promise<void>;
  onRemoved: (messageId: string) => void;
  onBack: () => void;
  onToggleMute: () => void;
  onOpenProfile?: (userId: string) => void;
  onTyping?: () => void;
};

function parseUtc(iso?: string | null): Date | null {
  if (!iso) return null;
  // The API stores naive UTC; without the marker the browser reads it as local
  // time and every message looks hours out.
  const parsed = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clockLabel(iso?: string | null): string {
  const date = parseUtc(iso);
  if (!date) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function MessageThread({
  conversation,
  messages,
  onLoadedOlder,
  onSend,
  onRemoved,
  onBack,
  onToggleMute,
  onOpenProfile,
  onTyping,
}: MessageThreadProps) {
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState<DirectMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const bottomAnchored = useRef(true);
  const previousHeight = useRef(0);

  const other = conversation.other;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMessages(conversation.id)
      .then((page) => {
        if (cancelled) return;
        onLoadedOlder(page.items);
        setCursor(page.next_cursor ?? null);
        setHasMore(page.has_more);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load messages."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Reload only when the thread changes; new messages arrive through sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Stay pinned to the newest message, but never yank the view down while
  // someone is reading back through history.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;

    if (loadingOlder) {
      // Preserve the reading position when older messages are prepended.
      node.scrollTop = node.scrollHeight - previousHeight.current;
      return;
    }
    if (bottomAnchored.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, loadingOlder]);

  const onScroll = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    bottomAnchored.current = distance < 80;
  }, []);

  const loadOlder = async () => {
    if (!cursor || loadingOlder) return;
    const node = scroller.current;
    previousHeight.current = node?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const page = await listMessages(conversation.id, cursor);
      onLoadedOlder(page.items);
      setCursor(page.next_cursor ?? null);
      setHasMore(page.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const remove = async (message: DirectMessage) => {
    try {
      await deleteMessage(message.id);
      onRemoved(message.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the message.");
    }
  };

  let lastDay = "";

  return (
    <section className="community-msg-thread">
      <header className="community-msg-thread-head">
        <button
          type="button"
          className="icon-btn community-msg-back"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} strokeWidth={1.9} aria-hidden />
        </button>

        <button
          type="button"
          className="community-msg-peer"
          onClick={() => other && onOpenProfile?.(other.id)}
        >
          <Avatar
            name={other?.full_name ?? "Member"}
            src={other?.avatar_url}
            size={38}
            role={other?.community_role}
          />
          <span>
            <strong>{other?.full_name ?? "Member"}</strong>
            {other?.headline && <small>{other.headline}</small>}
          </span>
        </button>

        <div className="community-msg-thread-menu">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Conversation options"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} strokeWidth={1.9} aria-hidden />
          </button>
          {menuOpen && (
            <div className="community-post-menu-list">
              <button
                type="button"
                onClick={() => {
                  onToggleMute();
                  setMenuOpen(false);
                }}
              >
                <BellOff size={14} strokeWidth={1.9} aria-hidden />
                {conversation.is_muted ? "Unmute" : "Mute"} conversation
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="community-msg-scroll" ref={scroller} onScroll={onScroll}>
        {hasMore && (
          <button
            type="button"
            className="community-btn ghost community-msg-older"
            onClick={loadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}

        {loading && messages.length === 0 && (
          <p className="community-muted community-msg-hint">Loading messages…</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="community-muted community-msg-hint">
            No messages yet. Say hello to {other?.full_name ?? "them"}.
          </p>
        )}

        {messages.map((message) => {
          const date = parseUtc(message.created_at);
          const day = date ? dayLabel(date) : "";
          const showDay = day && day !== lastDay;
          if (showDay) lastDay = day;

          return (
            <div key={message.id}>
              {showDay && <p className="community-msg-day">{day}</p>}

              <div
                className={`community-msg-bubble-row${message.is_mine ? " mine" : ""}`}
              >
                <div
                  className={`community-msg-bubble${message.is_mine ? " mine" : ""}${
                    message.is_removed ? " removed" : ""
                  }${message.pending ? " pending" : ""}${message.failed ? " failed" : ""}`}
                >
                  {message.is_removed ? (
                    <p className="community-msg-text removed">This message was removed</p>
                  ) : (
                    <>
                      {message.attachment && (
                        <ResearchAttachment file={message.attachment} />
                      )}
                      {message.body && (
                        <p className="community-msg-text">{message.body}</p>
                      )}
                    </>
                  )}

                  <span className="community-msg-time">
                    {message.failed
                      ? "Not sent"
                      : message.pending
                        ? "Sending…"
                        : clockLabel(message.created_at)}
                  </span>
                </div>

                {!message.is_removed && !message.pending && (
                  <div className="community-msg-bubble-actions">
                    {message.can_delete ? (
                      <button
                        type="button"
                        onClick={() => remove(message)}
                        aria-label="Delete message"
                      >
                        <Trash2 size={13} strokeWidth={2} aria-hidden />
                      </button>
                    ) : (
                      !message.is_mine && (
                        <button
                          type="button"
                          onClick={() => setReporting(message)}
                          aria-label="Report message"
                        >
                          <Flag size={13} strokeWidth={2} aria-hidden />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="community-inline-error community-msg-hint">{error}</p>}

      <MessageComposer onSend={onSend} onTyping={onTyping} />

      {reporting && (
        <ReportDialog
          targetType="message"
          targetId={reporting.id}
          targetLabel={`message from ${other?.full_name ?? "this member"}`}
          onClose={() => setReporting(null)}
        />
      )}
    </section>
  );
}
