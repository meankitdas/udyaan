"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import useCommunitySocket from "./useCommunitySocket";

/**
 * One socket for the whole community area.
 *
 * It used to live inside MessagesView, which meant a member only held a
 * presence key while the inbox was on screen — so anyone reading the feed or
 * the directory appeared offline to everyone else. Presence has to be a
 * property of "is in the community", not "is looking at Messages".
 *
 * Mounting it once here also stops each view opening its own connection.
 */

type MessageHandler = (conversationId: string, message: unknown) => void;

type CommunitySocketValue = {
  online: Record<string, boolean>;
  typingUsers: Record<string, boolean>;
  connected: boolean;
  requestPresence: (userIds: string[]) => void;
  setTyping: (isTyping: boolean) => void;
  /** Follow one conversation's typing channel; pass null to stop. */
  watchConversation: (conversationId: string | null) => void;
  setMessageHandler: (handler: MessageHandler | null) => void;
};

const noop = () => {};

const CommunitySocketContext = createContext<CommunitySocketValue>({
  online: {},
  typingUsers: {},
  connected: false,
  requestPresence: noop,
  setTyping: noop,
  watchConversation: noop,
  setMessageHandler: noop,
});

export function CommunitySocketProvider({ children }: { children: React.ReactNode }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const handler = useRef<MessageHandler | null>(null);

  const onMessage = useCallback<MessageHandler>((id, message) => {
    handler.current?.(id, message);
  }, []);

  const socket = useCommunitySocket({ conversationId, onMessage });

  const setMessageHandler = useCallback((next: MessageHandler | null) => {
    handler.current = next;
  }, []);

  const value = useMemo<CommunitySocketValue>(
    () => ({
      online: socket.online,
      typingUsers: socket.typingUsers,
      connected: socket.connected,
      requestPresence: socket.requestPresence,
      setTyping: socket.setTyping,
      watchConversation: setConversationId,
      setMessageHandler,
    }),
    [socket, setMessageHandler],
  );

  return (
    <CommunitySocketContext.Provider value={value}>
      {children}
    </CommunitySocketContext.Provider>
  );
}

export function useCommunitySocketContext(): CommunitySocketValue {
  return useContext(CommunitySocketContext);
}
