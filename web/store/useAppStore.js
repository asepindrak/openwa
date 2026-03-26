import { create } from "zustand";

function readToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("openwa-token");
}

function writeToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem("openwa-token", token);
    return;
  }

  window.localStorage.removeItem("openwa-token");
}

function sortChats(chats) {
  return [...chats].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}

export const useAppStore = create((set, get) => ({
  token: null,
  user: null,
  sessions: [],
  chats: [],
  activeChatId: null,
  activeSessionId: null,
  messagesByChat: {},
  messageMetaByChat: {},
  typingByChat: {},
  socket: null,
  hydrateAuth: () => {
    set({ token: readToken() });
  },
  setAuth: ({ token, user }) => {
    writeToken(token);
    set({ token, user });
  },
  logout: () => {
    writeToken(null);
    get().socket?.close();
    set({
      token: null,
      user: null,
      sessions: [],
      chats: [],
      activeChatId: null,
      activeSessionId: null,
      messagesByChat: {},
      messageMetaByChat: {},
      typingByChat: {},
      socket: null
    });
  },
  setBootstrapData: (payload) => {
    set((state) => ({
      user: payload.user,
      sessions: payload.sessions || [],
      chats: sortChats(payload.chats || []),
      activeChatId: payload.activeChatId || payload.chats?.[0]?.id || null,
      activeSessionId: state.activeSessionId || null,
      messagesByChat: payload.activeChatId
        ? {
            ...state.messagesByChat,
            [payload.activeChatId]: payload.messages || []
          }
        : state.messagesByChat,
      messageMetaByChat: payload.activeChatId
        ? {
            ...state.messageMetaByChat,
            [payload.activeChatId]: {
              hasMore: Boolean(payload.hasMoreMessages),
              nextBefore: payload.nextBefore || null
            }
          }
        : state.messageMetaByChat
    }));
  },
  setMessages: (chatId, messages, meta = null) => {
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: messages
      },
      messageMetaByChat: meta
        ? {
            ...state.messageMetaByChat,
            [chatId]: meta
          }
        : state.messageMetaByChat
    }));
  },
  prependMessages: (chatId, messages, meta) => {
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: [...messages, ...(state.messagesByChat[chatId] || [])]
      },
      messageMetaByChat: {
        ...state.messageMetaByChat,
        [chatId]: meta
      }
    }));
  },
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  upsertSession: (session) => {
    set((state) => {
      const normalizedSession = {
        ...session,
        id: session.id || session.sessionId
      };
      const sessions = state.sessions.some((item) => item.id === normalizedSession.id)
        ? state.sessions.map((item) => (item.id === normalizedSession.id ? { ...item, ...normalizedSession } : item))
        : [normalizedSession, ...state.sessions];

      return {
        sessions,
        activeSessionId: state.activeSessionId || normalizedSession.id || null
      };
    });
  },
  upsertChat: (chat) => {
    set((state) => {
      const chats = state.chats.some((item) => item.id === chat.id)
        ? state.chats.map((item) => (item.id === chat.id ? { ...item, ...chat } : item))
        : [chat, ...state.chats];

      return {
        chats: sortChats(chats)
      };
    });
  },
  addMessage: (message) => {
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [message.chatId]: [...(state.messagesByChat[message.chatId] || []), message]
      }
    }));
  },
  updateMessageStatus: ({ messageId, status }) => {
    set((state) => {
      const nextMessagesByChat = Object.fromEntries(
        Object.entries(state.messagesByChat).map(([chatId, messages]) => [
          chatId,
          messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  statuses: [...(message.statuses || []), { status, createdAt: new Date().toISOString() }]
                }
              : message
          )
        ])
      );

      return { messagesByChat: nextMessagesByChat };
    });
  },
  updateMessage: (message) => {
    set((state) => ({
      messagesByChat: Object.fromEntries(
        Object.entries(state.messagesByChat).map(([chatId, messages]) => [
          chatId,
          messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
        ])
      )
    }));
  },
  setTyping: ({ chatId, isTyping, name, userId }) => {
    set((state) => ({
      typingByChat: {
        ...state.typingByChat,
        [chatId]: { isTyping, name, userId }
      }
    }));
  },
  setSocket: (socket) => set({ socket })
}));
