"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, getToken } from "@/lib/portal-api";

/**
 * Live presence, typing indicators and message pushes.
 *
 * Sits alongside `useChatSync` rather than replacing it: the socket is an
 * accelerator, and `/messages/sync` stays the source of truth. If the socket
 * drops, messages still arrive on the next poll, so a reconnect storm degrades
 * latency instead of correctness.
 *
 * The token goes in `Sec-WebSocket-Protocol`, not the query string, because a
 * query string ends up in access logs and referrers.
 */

const HEARTBEAT_MS = 25000;
const MAX_BACKOFF_MS = 30000;
// Typing stops being shown if the sender goes quiet without a "stopped" frame,
// which is what happens when they close the tab mid-sentence.
const TYPING_TIMEOUT_MS = 6000;
// One frame per keystroke is pure waste; the receiver's timeout is 6s.
const TYPING_THROTTLE_MS = 2000;

function socketUrl(): string {
  return `${API_BASE_URL.replace(/^http/, "ws")}/community/ws`;
}

/**
 * Closing a socket that is still CONNECTING logs an error and, under React
 * StrictMode, that happens on every mount. Defer the close to `open` instead.
 */
function closeSocket(ws: WebSocket | null) {
  if (!ws) return;
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.addEventListener("open", () => ws.close(), { once: true });
  } else if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}

type Options = {
  enabled?: boolean;
  /** Conversation whose typing channel this client should follow. */
  conversationId?: string | null;
  onMessage?: (conversationId: string, message: unknown) => void;
};

export default function useCommunitySocket({
  enabled = true,
  conversationId = null,
  onMessage,
}: Options) {
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);

  const socket = useRef<WebSocket | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnect = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const attempts = useRef(0);
  // Who we want presence for. Kept so the request can be replayed on connect:
  // callers ask before the socket is open, and that first ask is dropped.
  const watched = useRef<string[]>([]);
  const lastTypingSentAt = useRef(0);
  // Held in refs so a changing callback identity never tears down the socket.
  const onMessageRef = useRef(onMessage);
  const conversationRef = useRef(conversationId);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Scoped to this effect run rather than a ref: a ref is shared across
    // mounts, so a remount resets it and the previous run's socket resurrects
    // itself on reconnect. It then pushes frames into the unmounted instance's
    // setters, which is silently discarded — the socket looks alive and nothing
    // ever updates.
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const token = getToken();
      if (!token) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(socketUrl(), ["bearer", token]);
      } catch {
        return;
      }
      socket.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attempts.current = 0;
        setConnected(true);
        if (conversationRef.current) {
          send({ type: "watch", conversation_id: conversationRef.current });
        }
        // Replay whatever was asked for while the socket was still connecting.
        if (watched.current.length) {
          send({ type: "presence", user_ids: watched.current });
        }
        heartbeat.current = setInterval(() => {
          send({ type: "heartbeat" });
          // Presence keys expire after 60s server-side and nothing pushes when
          // someone goes offline, so refresh rather than trusting the last answer.
          if (watched.current.length) {
            send({ type: "presence", user_ids: watched.current });
          }
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }

        if (frame.type === "presence") {
          setOnline((current) => ({ ...current, ...(frame.online as object) }));
        } else if (frame.type === "typing") {
          const userId = String(frame.user_id);
          const isTyping = Boolean(frame.is_typing);
          setTypingUsers((current) => ({ ...current, [userId]: isTyping }));
          clearTimeout(typingTimers.current[userId]);
          if (isTyping) {
            typingTimers.current[userId] = setTimeout(
              () => setTypingUsers((c) => ({ ...c, [userId]: false })),
              TYPING_TIMEOUT_MS,
            );
          }
        } else if (frame.type === "message") {
          onMessageRef.current?.(String(frame.conversation_id), frame.message);
        }
      };

      const scheduleReconnect = () => {
        if (heartbeat.current) clearInterval(heartbeat.current);
        if (cancelled) return;
        setConnected(false);
        attempts.current += 1;
        const delay = Math.min(1000 * 2 ** (attempts.current - 1), MAX_BACKOFF_MS);
        reconnect.current = setTimeout(connect, delay);
      };

      ws.onclose = scheduleReconnect;
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (heartbeat.current) clearInterval(heartbeat.current);
      if (reconnect.current) clearTimeout(reconnect.current);
      Object.values(typingTimers.current).forEach(clearTimeout);
      closeSocket(socket.current);
      socket.current = null;
    };
  }, [enabled, send]);

  // Follow whichever thread is on screen.
  useEffect(() => {
    conversationRef.current = conversationId;
    setTypingUsers({});
    if (connected) send({ type: "watch", conversation_id: conversationId ?? "" });
  }, [conversationId, connected, send]);

  const requestPresence = useCallback(
    (userIds: string[]) => {
      watched.current = userIds;
      if (userIds.length) send({ type: "presence", user_ids: userIds });
    },
    [send],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationRef.current) return;
      const now = Date.now();
      if (isTyping && now - lastTypingSentAt.current < TYPING_THROTTLE_MS) return;
      lastTypingSentAt.current = isTyping ? now : 0;
      send({
        type: "typing",
        conversation_id: conversationRef.current,
        is_typing: isTyping,
      });
    },
    [send],
  );

  return { online, typingUsers, connected, requestPresence, setTyping };
}
