"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { syncMessages } from "@/lib/community-api";
import type { Conversation, DirectMessage } from "@/lib/community-types";

/**
 * The messaging transport.
 *
 * Everything real-time flows through this one hook, deliberately. The backend
 * `/messages/sync` endpoint returns a *change set* -- new messages, touched
 * conversations, the unread total -- rather than a snapshot, so replacing
 * polling with SSE or WebSockets later means changing only the body of this
 * file: subscribe instead of poll, then call the same `onChange` with the same
 * payload. No component above it knows which transport is in use.
 *
 * Polling is the right default on the current infrastructure. Cloud Run scales
 * to zero with no session affinity, so a socket held by one instance cannot
 * reach a client attached to another without a shared pub/sub layer that isn't
 * provisioned. Polling has none of that coupling.
 *
 * The interval adapts so the cost is paid only where it buys something:
 *   - a thread is open and someone typed recently -> fast
 *   - the app is open but idle                    -> slow
 *   - the tab is hidden                           -> stopped entirely
 */

const ACTIVE_MS = 3000;
const IDLE_MS = 20000;
// How long after the last message before a conversation stops counting as busy.
const ACTIVITY_WINDOW_MS = 60000;

type SyncPayload = {
  messages: DirectMessage[];
  conversations: Conversation[];
  totalUnread: number;
};

type UseChatSyncOptions = {
  enabled?: boolean;
  /** Poll fast while a thread is on screen. */
  active?: boolean;
  onChange: (payload: SyncPayload) => void;
};

export default function useChatSync({
  enabled = true,
  active = false,
  onChange,
}: UseChatSyncOptions) {
  const [connected, setConnected] = useState(true);

  const cursor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const lastActivity = useRef(0);
  const failures = useRef(0);

  // Held in a ref so a new callback identity on every render doesn't tear down
  // and restart the poll loop.
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const nextDelay = useCallback(() => {
    if (failures.current > 0) {
      // Exponential backoff, capped: a backend that is down should not be
      // hammered by every open tab.
      return Math.min(IDLE_MS * 3, ACTIVE_MS * 2 ** failures.current);
    }
    const busy = Date.now() - lastActivity.current < ACTIVITY_WINDOW_MS;
    return activeRef.current && busy ? ACTIVE_MS : activeRef.current ? ACTIVE_MS * 2 : IDLE_MS;
  }, []);

  const tick = useCallback(async () => {
    if (inFlight.current || stopped.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    inFlight.current = true;
    try {
      const result = await syncMessages(cursor.current);
      cursor.current = result.cursor;
      failures.current = 0;
      setConnected(true);

      if (result.messages.length > 0) {
        lastActivity.current = Date.now();
      }
      if (result.messages.length > 0 || result.conversations.length > 0) {
        handler.current({
          messages: result.messages,
          conversations: result.conversations,
          totalUnread: result.total_unread,
        });
      }
    } catch {
      failures.current += 1;
      // One dropped poll is normal on a flaky connection; only surface an
      // offline state once it is clearly not transient.
      if (failures.current >= 3) setConnected(false);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await tick();
        if (!stopped.current) schedule();
      }, nextDelay());
    };

    // Establish the cursor immediately so the first real poll only asks for
    // genuinely new messages instead of replaying a backlog.
    tick().then(() => {
      if (!stopped.current) schedule();
    });

    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        // Catch up the moment the tab is focused rather than waiting out the
        // remainder of an idle interval.
        tick();
        schedule();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [enabled, tick, nextDelay]);

  /** Marks local activity so the next few polls run at the fast interval. */
  const noteActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  /** Forces an immediate poll, e.g. straight after sending a message. */
  const poll = useCallback(() => {
    lastActivity.current = Date.now();
    tick();
  }, [tick]);

  return { connected, noteActivity, poll };
}
