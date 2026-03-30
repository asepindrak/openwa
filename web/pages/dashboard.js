import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { AppHead } from "@/components/AppHead";
import { ChatWindow } from "@/components/ChatWindow";
import { ContactList } from "@/components/ContactList";
import { ContactsPanel } from "@/components/ContactsPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { apiFetch } from "@/lib/api";
import { createSocket } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";

export default function DashboardPage() {
  const [connectLoading, setConnectLoading] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const router = useRouter();
  const {
    token,
    user,
    hydrateAuth,
    logout,
    setBootstrapData,
    setMessages,
    prependMessages,
    setActiveChat,
    upsertSession,
    upsertChat,
    addMessage,
    updateMessageStatus,
    updateMessage,
    setSocket,
    socket,
    chats,
    sessions,
    activeChatId,
    activeSessionId,
    setActiveSession,
    messagesByChat,
    messageMetaByChat,
    typingByChat,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionPhone, setSessionPhone] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [startingContactId, setStartingContactId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsPanelOpen, setContactsPanelOpen] = useState(false);
  const chatWindowRef = useRef(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [activeChatId, chats],
  );
  const activeMessages = messagesByChat[activeChatId] || [];
  const activeMeta = messageMetaByChat[activeChatId] || {
    hasMore: false,
    nextBefore: null,
  };
  const activeTyping = typingByChat[activeChatId];
  const readySessions = sessions.filter(
    (session) => session.status === "ready",
  ).length;

  const loadContacts = useCallback(async () => {
    if (!token) {
      return;
    }

    setContactsLoading(true);
    try {
      const data = await apiFetch("/api/contacts", { token });
      setContacts(data.contacts || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setContactsLoading(false);
    }
  }, [token]);

  const loadApiKeys = useCallback(async () => {
    if (!token) {
      return;
    }

    setApiKeysLoading(true);
    try {
      const data = await apiFetch("/api/api-keys", { token });
      setApiKeys(data.apiKeys || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setApiKeysLoading(false);
    }
  }, [token]);

  const loadWorkspace = useCallback(
    async (showSpinner = false) => {
      if (!token) {
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }

      try {
        const data = await apiFetch("/api/bootstrap", { token });
        setBootstrapData(data);
      } catch (requestError) {
        setError(requestError.message);
        if (requestError.status === 401) {
          logout();
          router.replace("/");
        }
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [logout, router, setBootstrapData, token],
  );

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

    Promise.all([loadWorkspace(true), loadContacts(), loadApiKeys()]).finally(
      () => {
        setLoading(false);
      },
    );
  }, [loadApiKeys, loadContacts, loadWorkspace, router, token]);

  useEffect(() => {
    if (!activeSessionId && sessions[0]?.id) {
      setActiveSession(sessions[0].id);
    }
  }, [activeSessionId, sessions, setActiveSession]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socketClient = createSocket(token);
    setSocket(socketClient);

    socketClient.on("new_message", (message) => {
      addMessage(message);
    });

    socketClient.on("message_status_update", (payload) => {
      updateMessageStatus(payload);
    });

    socketClient.on("contact_list_update", (chat) => {
      upsertChat(chat);
      // trigger contacts refresh and show loading badge while fetching
      setContactsLoading(true);
      loadContacts();
    });

    socketClient.on("session_status_update", (session) => {
      upsertSession(session);
      // If session is connecting, show sync indicator; when ready, refresh workspace
      if (session.status === "connecting") {
        setContactsLoading(true);
      }

      if (session.status === "ready") {
        loadWorkspace();
        loadContacts();
        setContactsLoading(false);
      }
    });

    socketClient.on("workspace_synced", () => {
      // backend finished workspace sync
      loadWorkspace();
      loadContacts();
      setContactsLoading(false);
      setMessagesLoading(false);
    });

    socketClient.on("typing_event", (payload) => {
      useAppStore.getState().setTyping(payload);
    });

    return () => {
      socketClient.close();
      setSocket(null);
    };
  }, [
    addMessage,
    loadContacts,
    loadWorkspace,
    setSocket,
    token,
    updateMessageStatus,
    upsertChat,
    upsertSession,
  ]);

  useEffect(() => {
    if (!activeChatId) {
      setMessagesLoading(false);
      return;
    }

    if (messagesByChat[activeChatId]) {
      setMessagesLoading(false);
      return;
    }

    if (!token) {
      return;
    }

    setMessagesLoading(true);
    apiFetch(`/api/chats/${activeChatId}/messages`, { token })
      .then((data) => {
        setMessages(activeChatId, data.messages, {
          hasMore: Boolean(data.hasMore),
          nextBefore: data.nextBefore || null,
        });
      })
      .catch((requestError) => {
        setError(requestError.message);
      })
      .finally(() => {
        setMessagesLoading(false);
      });
  }, [activeChatId, messagesByChat, setMessages, token]);

  const handleCreateSession = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const data = await apiFetch("/api/sessions", {
        method: "POST",
        token,
        body: {
          name: sessionName,
          phoneNumber: sessionPhone,
        },
      });

      upsertSession(data.session);
      setActiveSession(data.session.id);
      setSessionName("");
      setSessionPhone("");
      setSettingsOpen(true);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleConnectSession = async (sessionId) => {
    setError("");
    setConnectLoading(sessionId);
    setQrLoading(true);
    try {
      const data = await apiFetch(`/api/sessions/${sessionId}/connect`, {
        method: "POST",
        token,
      });
      upsertSession(data.session);
      setActiveSession(sessionId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConnectLoading(null);
      setTimeout(() => setQrLoading(false), 1200); // beri waktu QR muncul
    }
  };

  const handleClearSession = async (sessionId) => {
    setError("");
    setConnectLoading(sessionId);
    try {
      await apiFetch(`/api/sessions/${sessionId}/disconnect`, {
        method: "POST",
        token,
      });
      await loadWorkspace(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConnectLoading(null);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    setError("");
    setConnectLoading(sessionId);
    try {
      await apiFetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        token,
      });
      await loadWorkspace(true);
      if (activeSessionId === sessionId) {
        setActiveSession(null);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConnectLoading(null);
    }
  };

  const handleDisconnectSession = async (sessionId) => {
    setError("");
    setConnectLoading(sessionId);
    try {
      const data = await apiFetch(`/api/sessions/${sessionId}/disconnect`, {
        method: "POST",
        token,
      });
      upsertSession(data.session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConnectLoading(null);
    }
  };

  const handleCreateApiKey = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const result = await apiFetch("/api/api-keys", {
        method: "POST",
        token,
        body: {
          name: apiKeyName,
        },
      });

      setApiKeySecret(result.secret);
      setApiKeyName("");
      setApiKeys((current) => [result.apiKey, ...current]);
      setSettingsOpen(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleRevokeApiKey = async (apiKeyId) => {
    setError("");

    try {
      await apiFetch(`/api/api-keys/${apiKeyId}`, {
        method: "DELETE",
        token,
      });

      setApiKeys((current) => current.filter((item) => item.id !== apiKeyId));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleOpenChat = async (chatId) => {
    setActiveChat(chatId);
    setMessageQuery("");
    socket?.emit("open_chat", { chatId });
  };

  const handleStartChat = async (contactId) => {
    setStartingContactId(contactId);
    setError("");

    try {
      const result = await apiFetch(`/api/contacts/${contactId}/open`, {
        method: "POST",
        token,
      });

      upsertChat(result.chat);
      await handleOpenChat(result.chat.id);
      setContacts((current) =>
        current.map((item) =>
          item.id === contactId
            ? { ...item, hasChat: true, chatId: result.chat.id }
            : item,
        ),
      );
      setContactsPanelOpen(false);
      setTimeout(() => {
        chatWindowRef.current?.focusComposer();
      }, 80);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStartingContactId(null);
    }
  };

  const handleSendMessage = async ({ body, replyToId }) => {
    if (!socket) {
      throw new Error("Socket connection is not ready yet.");
    }

    await new Promise((resolve, reject) => {
      socket.emit(
        "send_message",
        {
          chatId: activeChatId,
          body,
          type: "text",
          replyToId,
        },
        (response) => {
          if (response?.ok) {
            resolve(response.message);
            return;
          }

          reject(new Error(response?.error || "Failed to send message."));
        },
      );
    });
  };

  const handleSendMedia = async ({ file, caption }) => {
    if (!socket) {
      throw new Error("Socket connection is not ready yet.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const upload = await apiFetch("/api/media", {
      method: "POST",
      token,
      formData,
    });

    await new Promise((resolve, reject) => {
      socket.emit(
        "send_media",
        {
          chatId: activeChatId,
          mediaFileId: upload.mediaFile.id,
          body: caption,
          type: upload.type,
        },
        (response) => {
          if (response?.ok) {
            resolve(response.message);
            return;
          }

          reject(new Error(response?.error || "Failed to send media."));
        },
      );
    });
  };

  const handleTyping = (isTyping) => {
    socket?.emit("typing", {
      chatId: activeChatId,
      isTyping,
    });
  };

  const handleLoadOlder = async () => {
    if (!activeChatId || !activeMeta.hasMore || !activeMeta.nextBefore) {
      return;
    }

    setLoadingOlder(true);
    try {
      const data = await apiFetch(
        `/api/chats/${activeChatId}/messages?before=${encodeURIComponent(activeMeta.nextBefore)}&take=30`,
        { token },
      );
      prependMessages(activeChatId, data.messages, {
        hasMore: Boolean(data.hasMore),
        nextBefore: data.nextBefore || null,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const result = await apiFetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        token,
      });
      updateMessage(result.message);
      upsertChat(result.chat);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleForwardMessage = async (messageId, targetChatId) => {
    try {
      const result = await apiFetch(`/api/messages/${messageId}/forward`, {
        method: "POST",
        token,
        body: { targetChatId },
      });
      addMessage(result.message);
      upsertChat(result.chat);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <>
      <AppHead
        title="Dashboard"
        description="Dashboard OpenWA untuk mengelola percakapan, kontak, device, dan session WhatsApp."
      />

      {/* Global small loading badge for slow WA syncs */}
      {contactsLoading || messagesLoading || loading ? (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md bg-black/60 px-3 py-2 text-sm text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
          <span>
            {loading
              ? "Refreshing workspace..."
              : contactsLoading
                ? "Syncing contacts..."
                : "Fetching messages..."}
          </span>
        </div>
      ) : null}

      <main className="h-screen overflow-hidden bg-[#161717] text-white">
        <div className="flex h-full w-full overflow-hidden bg-[#161717]">
          <aside className="flex flex-col">
            <button
              className="mx-5 mt-5 mb-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a] hover:bg-brand-600 transition"
              onClick={() => loadWorkspace(true)}
              disabled={loading}
              title="Reload conversations"
            >
              {loading ? "Reloading..." : "Reload Conversations"}
            </button>
            <ContactList
              chats={chats}
              activeChatId={activeChatId}
              loading={loading}
              onSelectChat={handleOpenChat}
              currentUser={user}
              query={chatQuery}
              onQueryChange={setChatQuery}
            />
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            {error ? (
              <div className="mx-4 mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1">
              <ChatWindow
                ref={chatWindowRef}
                chat={activeChat}
                messages={activeMessages}
                chats={chats}
                typingState={activeTyping}
                loading={loading}
                messagesLoading={messagesLoading}
                loadingOlder={loadingOlder}
                hasMoreMessages={activeMeta.hasMore}
                messageQuery={messageQuery}
                onMessageQueryChange={setMessageQuery}
                onLoadOlder={handleLoadOlder}
                onSendMessage={handleSendMessage}
                onSendMedia={handleSendMedia}
                onTyping={handleTyping}
                onDeleteMessage={handleDeleteMessage}
                onForwardMessage={handleForwardMessage}
                onOpenContacts={() => setContactsPanelOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onLogout={() => {
                  logout();
                  router.replace("/");
                }}
              />

              <ContactsPanel
                contacts={contacts}
                loading={contactsLoading}
                open={contactsPanelOpen}
                query={contactQuery}
                onQueryChange={setContactQuery}
                onStartChat={handleStartChat}
                onClose={() => setContactsPanelOpen(false)}
                startingContactId={startingContactId}
              />
            </div>
          </section>
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onClose={() => setSettingsOpen(false)}
        onSelect={setActiveSession}
        onConnect={handleConnectSession}
        onDisconnect={handleDisconnectSession}
        onClearSession={handleClearSession}
        onDeleteSession={handleDeleteSession}
        connectLoading={connectLoading}
        qrLoading={qrLoading}
        sessionName={sessionName}
        sessionPhone={sessionPhone}
        onSessionNameChange={setSessionName}
        onSessionPhoneChange={setSessionPhone}
        onCreateSession={handleCreateSession}
        apiKeys={apiKeys}
        apiKeysLoading={apiKeysLoading}
        apiKeyName={apiKeyName}
        apiKeySecret={apiKeySecret}
        onApiKeyNameChange={setApiKeyName}
        onCreateApiKey={handleCreateApiKey}
        onRevokeApiKey={handleRevokeApiKey}
      />
    </>
  );
}
