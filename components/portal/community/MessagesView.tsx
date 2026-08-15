"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, WifiOff } from "lucide-react";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import useChatSync from "./useChatSync";
import useCommunitySocket from "./useCommunitySocket";
import {
  listConversations,
  markConversationRead,
  openConversation,
  sendMessage,
  updateConversation,
} from "@/lib/community-api";
import type { Attachment, Conversation, DirectMessage } from "@/lib/community-types";

type MessagesViewProps = {
  /** Opens (or creates) a thread with this member as soon as the view mounts. */
  startWithUserId?: string | null;
  onOpenProfile?: (userId: string) => void;
  onUnreadChange?: (total: number) => void;
};

function sortConversations(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => {
    const at = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
    const bt = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
    return bt - at;
  });
}

export default function MessagesView({
  startWithUserId,
  onOpenProfile,
  onUnreadChange,
}: MessagesViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, DirectMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read inside callbacks that must not be re-created when the thread changes.
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeMessages = useMemo(
    () => (activeId ? (messages[activeId] ?? []) : []),
    [messages, activeId],
  );

  const mergeMessages = useCallback(
    (conversationId: string, incoming: DirectMessage[]) => {
      if (incoming.length === 0) return;
      setMessages((prev) => {
        const existing = prev[conversationId] ?? [];
        const byId = new Map(existing.map((m) => [m.id, m]));
        for (const message of incoming) byId.set(message.id, message);

        const merged = [...byId.values()].sort((a, b) => {
          const at = new Date(a.created_at ?? 0).getTime();
          const bt = new Date(b.created_at ?? 0).getTime();
          return at === bt ? a.id.localeCompare(b.id) : at - bt;
        });
        return { ...prev, [conversationId]: merged };
      });
    },
    [],
  );

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listConversations();
      setConversations(sortConversations(page.items));
      onUnreadChange?.(page.total_unread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // Deep link from a profile's "Message" button.
  useEffect(() => {
    if (!startWithUserId) return;
    let cancelled = false;
    openConversation(startWithUserId)
      .then((conversation) => {
        if (cancelled) return;
        setConversations((prev) =>
          sortConversations([
            conversation,
            ...prev.filter((c) => c.id !== conversation.id),
          ]),
        );
        setActiveId(conversation.id);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not open that conversation."),
      );
    return () => {
      cancelled = true;
    };
  }, [startWithUserId]);

  const markRead = useCallback(
    async (conversationId: string) => {
      try {
        const result = await markConversationRead(conversationId);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unread_count: result.unread_count } : c,
          ),
        );
        onUnreadChange?.(result.total_unread);
      } catch {
        // A failed receipt only means the badge lags; the next open retries.
      }
    },
    [onUnreadChange],
  );

  useEffect(() => {
    if (activeId) markRead(activeId);
  }, [activeId, markRead]);

  // --- transport ---------------------------------------------------------
  const handleSync = useCallback(
    ({
      messages: incoming,
      conversations: touched,
      totalUnread,
    }: {
      messages: DirectMessage[];
      conversations: Conversation[];
      totalUnread: number;
    }) => {
      const grouped = new Map<string, DirectMessage[]>();
      for (const message of incoming) {
        const list = grouped.get(message.conversation_id) ?? [];
        list.push(message);
        grouped.set(message.conversation_id, list);
      }
      for (const [conversationId, list] of grouped) {
        mergeMessages(conversationId, list);
      }

      if (touched.length > 0) {
        setConversations((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const conversation of touched) byId.set(conversation.id, conversation);
          return sortConversations([...byId.values()]);
        });
      }

      onUnreadChange?.(totalUnread);

      // A message that lands in the thread already on screen has effectively
      // been read, so clear it rather than flashing a badge the user must
      // dismiss by clicking what they are already looking at.
      const open = activeRef.current;
      if (open && grouped.has(open)) {
        markRead(open);
      }
    },
    [mergeMessages, markRead, onUnreadChange],
  );

  const { connected, noteActivity, poll } = useChatSync({
    active: Boolean(activeId),
    onChange: handleSync,
  });

  const handlePushed = useCallback(
    (conversationId: string, message: unknown) => {
      mergeMessages(conversationId, [message as DirectMessage]);
      if (activeRef.current === conversationId) markRead(conversationId);
      else poll();
    },
    [mergeMessages, markRead, poll],
  );

  const {
    online,
    typingUsers,
    requestPresence,
    setTyping,
  } = useCommunitySocket({ conversationId: activeId, onMessage: handlePushed });

  // Re-ask whenever the set of people in the inbox changes.
  const peerIds = useMemo(
    () => conversations.map((c) => c.other?.id).filter((id): id is string => Boolean(id)),
    [conversations],
  );
  useEffect(() => {
    requestPresence(peerIds);
  }, [peerIds, requestPresence]);

  // --- sending -----------------------------------------------------------
  const send = useCallback(
    async (body: string, attachment: Attachment | null) => {
      const conversationId = activeRef.current;
      if (!conversationId) return;

      const token = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const optimistic: DirectMessage = {
        id: token,
        conversation_id: conversationId,
        sender_id: "me",
        body: body || null,
        attachment,
        is_mine: true,
        is_removed: false,
        can_delete: false,
        created_at: new Date().toISOString(),
        pending: true,
      };
      mergeMessages(conversationId, [optimistic]);

      try {
        const saved = await sendMessage(conversationId, {
          body: body || null,
          attachment,
          client_token: token,
        });
        // Drop the placeholder and insert the stored row, rather than leaving
        // both and showing the message twice.
        setMessages((prev) => {
          const list = (prev[conversationId] ?? []).filter((m) => m.id !== token);
          return { ...prev, [conversationId]: [...list, saved] };
        });
        setConversations((prev) =>
          sortConversations(
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    last_message_at: saved.created_at ?? c.last_message_at,
                    last_message_preview: saved.body ?? "📎 Attachment",
                    last_message_is_mine: true,
                  }
                : c,
            ),
          ),
        );
        poll();
      } catch (err) {
        setMessages((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.id === token ? { ...m, pending: false, failed: true } : m,
          ),
        }));
        throw err;
      }
    },
    [mergeMessages, poll],
  );

  const toggleMute = useCallback(async () => {
    if (!active) return;
    try {
      const updated = await updateConversation(active.id, { is_muted: !active.is_muted });
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the conversation.");
    }
  }, [active]);

  return (
    <div className={`community-messages${activeId ? " has-thread" : ""}`}>
      {!connected && (
        <p className="community-msg-offline">
          <WifiOff size={14} strokeWidth={2} aria-hidden />
          Reconnecting… new messages may be delayed.
        </p>
      )}

      {error && <p className="community-error">{error}</p>}

      <div className="community-msg-layout">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          loading={loading}
          online={online}
          onSelect={(conversation) => setActiveId(conversation.id)}
        />

        {active ? (
          <MessageThread
            conversation={active}
            messages={activeMessages}
            onLoadedOlder={(older) => mergeMessages(active.id, older)}
            onSend={send}
            onRemoved={(messageId) =>
              setMessages((prev) => ({
                ...prev,
                [active.id]: (prev[active.id] ?? []).map((m) =>
                  m.id === messageId
                    ? { ...m, is_removed: true, body: null, attachment: null, can_delete: false }
                    : m,
                ),
              }))
            }
            onBack={() => setActiveId(null)}
            onToggleMute={toggleMute}
            onOpenProfile={onOpenProfile}
            onTyping={() => {
              noteActivity();
              setTyping(true);
            }}
            onStopTyping={() => setTyping(false)}
            isOnline={active.other ? online[active.other.id] : undefined}
            isPeerTyping={Boolean(active.other && typingUsers[active.other.id])}
          />
        ) : (
          <div className="community-msg-placeholder">
            <MessagesSquare size={30} strokeWidth={1.6} aria-hidden />
            <h4>Your messages</h4>
            <p>Pick a conversation to read it, or start one from a member&rsquo;s profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}
