import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderStatus(message) {
  const status = message.statuses?.[message.statuses.length - 1]?.status;
  if (!status || message.direction !== "outbound") {
    return "";
  }

  return status === "read" ? "Read" : status === "delivered" ? "Delivered" : "Sent";
}

function previewReply(message) {
  if (!message) {
    return "";
  }

  if (message.body) {
    return message.body;
  }

  if (message.mediaFile?.originalName) {
    return message.mediaFile.originalName;
  }

  return "Attachment";
}

function initials(value) {
  return String(value || "?")
    .slice(0, 2)
    .toUpperCase();
}

function ChatAvatar({ src, label }) {
  if (src) {
    return <img src={src} alt={label} className="h-11 w-11 rounded-2xl object-cover" />;
  }

  return <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2e2f2f] text-sm font-semibold text-white">{initials(label)}</div>;
}

function renderMediaPreview(message) {
  if (!message.mediaFile) {
    return null;
  }

  const mediaUrl = `${getApiBaseUrl()}/${message.mediaFile.relativePath}`;
  const mimeType = String(message.mediaFile.mimeType || "");
  const isSticker = message.type === "sticker" || mimeType === "image/webp";

  if (isSticker) {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className="mb-2 inline-flex overflow-hidden rounded-2xl bg-transparent">
        <img src={mediaUrl} alt={message.mediaFile.originalName} className="h-36 w-36 object-contain drop-shadow-sm" />
      </a>
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-2xl">
        <img src={mediaUrl} alt={message.mediaFile.originalName} className="max-h-[320px] w-full rounded-2xl object-cover" />
      </a>
    );
  }

  if (mimeType.startsWith("video/")) {
    return (
      <video controls className="mb-2 max-h-[320px] w-full rounded-2xl bg-black">
        <source src={mediaUrl} type={mimeType} />
      </video>
    );
  }

  if (mimeType.startsWith("audio/")) {
    return <audio controls className="mb-2 w-full"><source src={mediaUrl} type={mimeType} /></audio>;
  }

  return (
    <a href={mediaUrl} target="_blank" rel="noreferrer" className="mb-2 inline-flex rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white underline-offset-2 hover:underline">
      {message.mediaFile.originalName}
    </a>
  );
}

export const ChatWindow = forwardRef(function ChatWindow({
  chat,
  messages,
  chats,
  typingState,
  loading,
  loadingOlder,
  hasMoreMessages,
  messageQuery,
  onMessageQueryChange,
  onLoadOlder,
  onSendMessage,
  onSendMedia,
  onTyping,
  onDeleteMessage,
  onForwardMessage,
  onOpenContacts,
  onOpenSettings,
  onLogout
}, ref) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardingMessageId, setForwardingMessageId] = useState(null);
  const [forwardTargetChatId, setForwardTargetChatId] = useState("");
  const [searchOpen, setSearchOpen] = useState(Boolean(messageQuery));
  const composerRef = useRef(null);
  const searchInputRef = useRef(null);

  const filteredMessages = useMemo(() => {
    const query = String(messageQuery || "").trim().toLowerCase();
    if (!query) {
      return messages;
    }

    return messages.filter((message) =>
      [message.body, message.sender, message.replyTo?.body, message.mediaFile?.originalName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [messageQuery, messages]);

  const forwardTargets = chats.filter((item) => item.id !== chat?.id);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendDraft();
  };

  const sendDraft = async () => {
    if (!draft.trim()) {
      return;
    }

    setBusy(true);

    try {
      await onSendMessage({ body: draft.trim(), replyToId: replyTo?.id || null });
      setDraft("");
      setReplyTo(null);
      onTyping(false);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      await onSendMedia({ file, caption: draft.trim() });
      setDraft("");
      setReplyTo(null);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleForward = async (messageId) => {
    if (!forwardTargetChatId) {
      return;
    }

    await onForwardMessage(messageId, forwardTargetChatId);
    setForwardingMessageId(null);
    setForwardTargetChatId("");
  };

  useImperativeHandle(ref, () => ({
    focusComposer() {
      composerRef.current?.focus();
    }
  }), []);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-white/50">Memuat dashboard...</div>;
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#161717] px-8 text-center text-white/50">
        <div>
          <p className="text-lg font-medium text-white">Belum ada chat yang dibuka</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-white/45">Mulai percakapan baru dari contact composer agar flow-nya terasa seperti WhatsApp Web.</p>
          <button type="button" className="mt-5 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-[#10251a]" onClick={onOpenContacts}>
            New chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#161717] text-white">
      <header className="flex h-[78px] shrink-0 items-center justify-between gap-4 bg-[#161717] px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <ChatAvatar src={chat.contact.avatarUrl} label={chat.contact.displayName} />
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-white">{chat.contact.displayName}</h2>
            <p className="text-sm text-white/40">{typingState?.isTyping ? `${typingState.name} sedang mengetik...` : "WhatsApp chat synced locally"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {searchOpen || messageQuery ? (
            <div className="flex items-center gap-2 rounded-[22px] bg-[#2e2f2f] px-4 py-2">
              <input
                ref={searchInputRef}
                className="w-[220px] border-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                placeholder="Cari pesan..."
                value={messageQuery}
                onChange={(event) => onMessageQueryChange(event.target.value)}
              />
              <button
                type="button"
                title="Close search"
                aria-label="Close search"
                className="text-sm leading-none text-white/55 transition hover:text-white"
                onClick={() => {
                  onMessageQueryChange("");
                  setSearchOpen(false);
                }}
              >
                ×
              </button>
            </div>
          ) : null}
          <button type="button" title="Search" aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-base leading-none text-white transition hover:bg-[#3a3b3b]" onClick={() => setSearchOpen(true)}>⌕</button>
          <button type="button" title="New chat" aria-label="New chat" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-lg leading-none text-white transition hover:bg-[#3a3b3b]" onClick={onOpenContacts}><span className="-mt-px">+</span></button>
          <button type="button" title="Settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-base leading-none text-white transition hover:bg-[#3a3b3b]" onClick={onOpenSettings}>⚙</button>
          <button type="button" title="Logout" aria-label="Logout" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-base leading-none text-white transition hover:bg-[#3a3b3b]" onClick={onLogout}>⎋</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#161717] px-8 py-5">
        <div className="mb-5 flex justify-center">
          <button
            type="button"
            className="rounded-full bg-[#2e2f2f] px-4 py-2 text-xs font-medium text-white/60 transition hover:text-white disabled:opacity-40"
            onClick={onLoadOlder}
            disabled={!hasMoreMessages || loadingOlder}
          >
            {loadingOlder ? "Memuat..." : hasMoreMessages ? "Load older messages" : "Semua pesan sudah dimuat"}
          </button>
        </div>

        <div className="space-y-3">
          {filteredMessages.map((message) => {
            const outbound = message.direction === "outbound";

            return (
              <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[72%] rounded-[18px] px-4 py-3 shadow-[0_16px_32px_rgba(0,0,0,0.18)] ${outbound ? "bg-[#144d37]" : "bg-[#2e2f2f]"}`}>
                  {message.replyTo ? (
                    <div className="mb-2 rounded-2xl border-l-4 border-brand-500 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
                      <span className="font-semibold text-white">{message.replyTo.direction === "outbound" ? "Anda" : chat.contact.displayName}</span>
                      <p className="mt-1 truncate">{previewReply(message.replyTo)}</p>
                    </div>
                  ) : null}

                  {renderMediaPreview(message)}
                  {message.body ? <p className="whitespace-pre-wrap text-sm leading-6 text-white/88">{message.body}</p> : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/35">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" title="Reply" aria-label="Reply" className="rounded-full px-2 py-1 transition hover:bg-white/[0.06] hover:text-white" onClick={() => setReplyTo(message)}>↩</button>
                      {outbound ? <button type="button" title="Delete" aria-label="Delete" className="rounded-full px-2 py-1 transition hover:bg-red-500/10 hover:text-red-300" onClick={() => onDeleteMessage(message.id)}>🗑</button> : null}
                      <button
                        type="button"
                        title="Forward"
                        aria-label="Forward"
                        className="rounded-full px-2 py-1 transition hover:bg-white/[0.06] hover:text-white"
                        onClick={() => {
                          setForwardingMessageId((current) => (current === message.id ? null : message.id));
                          setForwardTargetChatId("");
                        }}
                      >
                        ↪
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{formatTime(message.createdAt)}</span>
                      {outbound ? <span>{renderStatus(message)}</span> : null}
                    </div>
                  </div>

                  {forwardingMessageId === message.id ? (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-3">
                      <select
                        className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-[#0b141a] px-3 py-2 text-sm text-white outline-none"
                        value={forwardTargetChatId}
                        onChange={(event) => setForwardTargetChatId(event.target.value)}
                      >
                        <option value="">Pilih chat tujuan</option>
                        {forwardTargets.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.contact.displayName}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]" onClick={() => handleForward(message.id)}>Kirim</button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form className="shrink-0 bg-[#161717] px-6 py-3" onSubmit={handleSubmit}>
        {replyTo ? (
          <div className="mb-3 flex items-start justify-between rounded-2xl bg-[#2e2f2f] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-100">Reply</p>
              <p className="mt-1 truncate text-sm text-white/55">{previewReply(replyTo)}</p>
            </div>
            <button type="button" className="text-sm text-white/45 hover:text-white" onClick={() => setReplyTo(null)}>×</button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#2e2f2f] text-[24px] leading-none text-white/60 transition hover:bg-[#3a3b3b] hover:text-white">
            <span className="-mt-px">+</span>
            <input type="file" className="hidden" onChange={handleFile} />
          </label>
          <div className="flex flex-1 items-center rounded-[22px] bg-[#2e2f2f] px-4 py-2">
            <textarea
              ref={composerRef}
              rows={1}
              className="min-h-[20px] w-full resize-none overflow-y-auto border-none bg-transparent px-1 py-0.5 text-sm leading-5 text-white outline-none placeholder:text-white/30"
              placeholder="Type a message"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                onTyping(Boolean(event.target.value));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!busy && !uploading) {
                    sendDraft();
                  }
                }
              }}
            />
          </div>
          <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold leading-none text-[#10251a] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || uploading}>
            ➤
          </button>
        </div>
      </form>
    </section>
  );
});
