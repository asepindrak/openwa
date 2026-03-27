import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { MessageActionMenu } from "./MessageActionMenu";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { EmojiPicker } from "./EmojiPicker";
import { SendButtonSpinner } from "./Skeletons";
import { MdMoreVert, MdSend, MdEmojiEmotions, MdSearch, MdAdd, MdSettings, MdLogout, MdClose } from "react-icons/md";

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

function isImageFile(mimeType) {
  return mimeType && mimeType.startsWith("image/") && mimeType !== "image/webp";
}

function groupConsecutiveImages(messages) {
  const groups = [];
  let currentGroup = null;
  const TWO_MINUTES = 2 * 60 * 1000;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const mimeType = String(message.mediaFile?.mimeType || "");
    const isImage = message.mediaFile && isImageFile(mimeType);

    if (isImage && currentGroup === null) {
      // Start a new image group
      currentGroup = {
        type: "image-group",
        messages: [message],
        direction: message.direction,
        startTime: new Date(message.createdAt).getTime()
      };
    } else if (
      isImage &&
      currentGroup &&
      currentGroup.type === "image-group" &&
      currentGroup.direction === message.direction &&
      (new Date(message.createdAt).getTime() - currentGroup.startTime) <= TWO_MINUTES
    ) {
      // Add to current group
      currentGroup.messages.push(message);
    } else {
      // Not consecutive, save current group if exists
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      // Add single message
      if (!isImage) {
        groups.push({ type: "single", message });
      }
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

function renderGridImage(group, onImageClick) {
  const images = group.messages.map(msg => msg.mediaFile).filter(Boolean);
  if (images.length === 0) return null;

  if (images.length === 1) {
    const img = images[0];
    const mediaUrl = `${getApiBaseUrl()}/${img.relativePath}`;
    return (
      <img
        src={mediaUrl}
        alt={img.originalName}
        className="mb-2 h-24 w-24 cursor-pointer rounded-2xl object-cover"
        onClick={() => onImageClick({ 
          mediaUrl, 
          relativePath: img.relativePath, 
          mimeType: img.mimeType,
          originalName: img.originalName,
          isImage: true
        })}
      />
    );
  }

  return (
    <div className="mb-2 grid grid-cols-2 gap-1">
      {images.map((img, idx) => {
        const mediaUrl = `${getApiBaseUrl()}/${img.relativePath}`;
        return (
          <img
            key={idx}
            src={mediaUrl}
            alt={img.originalName}
            className="h-32 w-32 cursor-pointer rounded-lg object-cover"
            onClick={() => onImageClick({ 
              mediaUrl, 
              relativePath: img.relativePath, 
              mimeType: img.mimeType,
              originalName: img.originalName,
              isImage: true
            })}
          />
        );
      })}
    </div>
  );
}

function renderMediaPreviewWithCallback(message, onImageClick) {
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

  if (isImageFile(mimeType)) {
    return (
      <img
        src={mediaUrl}
        alt={message.mediaFile.originalName}
        className="mb-2 max-h-[320px] w-full cursor-pointer rounded-2xl object-cover"
        onClick={() => onImageClick && onImageClick({ 
          mediaUrl, 
          relativePath: message.mediaFile.relativePath, 
          mimeType: message.mediaFile.mimeType,
          originalName: message.mediaFile.originalName,
          isImage: true
        })}
      />
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
  messagesLoading,
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
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [selectedMediaModal, setSelectedMediaModal] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const composerRef = useRef(null);
  const searchInputRef = useRef(null);
  const messagesViewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pendingOpenChatScrollRef = useRef(false);
  const previousMessagesCountRef = useRef(0);
  const fileInputRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const emojiTriggerRef = useRef(null);

  const searchResults = useMemo(() => {
    const query = String(messageQuery || "").trim().toLowerCase();
    if (!query) {
      return [];
    }

    return messages
      .map((message, index) => {
        const matches = [message.body, message.sender, message.replyTo?.body, message.mediaFile?.originalName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
        return matches ? index : -1;
      })
      .filter((index) => index !== -1);
  }, [messageQuery, messages]);

  const filteredMessages = useMemo(() => {
    if (!messageQuery) {
      return messages;
    }
    return messages;
  }, [messageQuery, messages]);

  const forwardTargets = chats.filter((item) => item.id !== chat?.id);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingFiles.length > 0) {
      await handleSendWithFiles();
    } else if (draft.trim()) {
      await sendDraft();
    }
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
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const newPendingFiles = [];
    for (let file of files) {
      let preview = null;
      const mimeType = file.type || "";

      if (mimeType.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      } else if (mimeType.startsWith("video/")) {
        preview = URL.createObjectURL(file);
      }

      newPendingFiles.push({
        file,
        name: file.name,
        size: file.size,
        type: mimeType,
        preview
      });
    }

    setPendingFiles((current) => [...current, ...newPendingFiles]);
    event.target.value = "";
  };

  const removePendingFile = (index) => {
    setPendingFiles((current) => {
      const updated = [...current];
      const file = updated[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSendWithFiles = async () => {
    if (pendingFiles.length === 0) {
      return sendDraft();
    }

    setBusy(true);
    setUploading(true);
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const pendingFile = pendingFiles[i];
        const isLastFile = i === pendingFiles.length - 1;
        const caption = isLastFile ? draft.trim() : "";

        await onSendMedia({ file: pendingFile.file, caption });
      }
      setDraft("");
      setReplyTo(null);
      setPendingFiles([]);
    } finally {
      setBusy(false);
      setUploading(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    const textarea = composerRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const newDraft = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(newDraft);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);

    setEmojiPickerOpen(false);
  };


  const handleForward = async (messageId) => {
    if (!forwardTargetChatId) {
      return;
    }

    await onForwardMessage(messageId, forwardTargetChatId);
    setForwardingMessageId(null);
    setForwardTargetChatId("");
  };

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (searchResultIndex + 1) % searchResults.length;
    setSearchResultIndex(nextIndex);
    scrollToSearchResult(nextIndex);
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (searchResultIndex - 1 + searchResults.length) % searchResults.length;
    setSearchResultIndex(prevIndex);
    scrollToSearchResult(prevIndex);
  };

  const scrollToSearchResult = (resultIndex) => {
    if (searchResults.length === 0) return;
    const messageIndex = searchResults[resultIndex];
    const messageElement = document.querySelector(`[data-message-id="${messages[messageIndex]?.id}"]`);
    if (messageElement && messagesViewportRef.current) {
      messagesViewportRef.current.scrollTop = messageElement.offsetTop - messagesViewportRef.current.offsetTop;
    }
  };

  useEffect(() => {
    if (messageQuery && searchResults.length > 0) {
      setSearchResultIndex(0);
      scrollToSearchResult(0);
    }
  }, [messageQuery]);

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

  useEffect(() => {
    pendingOpenChatScrollRef.current = true;
  }, [chat?.id]);

  useEffect(() => {
    if (!chat?.id || !pendingOpenChatScrollRef.current) {
      return;
    }

    const scrollToBottom = () => {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTo({
          top: messagesViewportRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
      pendingOpenChatScrollRef.current = false;
    };

    if (!messages.length) {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTo({
          top: messagesViewportRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
      pendingOpenChatScrollRef.current = false;
      return;
    }

    // Detect if this is initial load (message count increased significantly)
    const isInitialLoad = previousMessagesCountRef.current === 0 && messages.length > 0;
    previousMessagesCountRef.current = messages.length;
    
    // Use longer delay for initial load since DOM needs more time to render many messages
    const delay = isInitialLoad ? 300 : 100;

    // Wait for DOM to render all messages before scrolling
    // Use multiple frames and a timeout to ensure layout is complete
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        });
      });
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [chat?.id, messages.length, messagesLoading]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-white/50">Loading dashboard...</div>;
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#161717] px-8 text-center text-white/50">
        <div>
          <p className="text-lg font-medium text-white">No chat selected</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-white/45">Start a new conversation from the contact selector to begin chatting.</p>
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
            <p className="text-sm text-white/40">{typingState?.isTyping ? `${typingState.name} is typing...` : "WhatsApp chat synced locally"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {searchOpen || messageQuery ? (
            <div className="flex items-center gap-2 rounded-[22px] bg-[#2e2f2f] px-4 py-2">
              <input
                ref={searchInputRef}
                className="w-[180px] border-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                placeholder="Search messages..."
                value={messageQuery}
                onChange={(event) => onMessageQueryChange(event.target.value)}
              />
              {searchResults.length > 0 && (
                <span className="text-xs text-white/60">
                  {searchResultIndex + 1}/{searchResults.length}
                </span>
              )}
              {searchResults.length > 0 && (
                <>
                  <button
                    type="button"
                    title="Previous result"
                    aria-label="Previous result"
                    className="text-sm leading-none text-white/55 transition hover:text-white"
                    onClick={handleSearchPrev}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Next result"
                    aria-label="Next result"
                    className="text-sm leading-none text-white/55 transition hover:text-white"
                    onClick={handleSearchNext}
                  >
                    ↓
                  </button>
                </>
              )}
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
                <MdClose className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          <button type="button" title="Search" aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-base leading-none text-white transition hover:bg-[#3a3b3b]" onClick={() => setSearchOpen(true)}><MdSearch className="w-5 h-5" /></button>
          <button type="button" title="New chat" aria-label="New chat" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-lg leading-none text-white transition hover:bg-[#3a3b3b]" onClick={onOpenContacts}><MdAdd className="w-5 h-5" /></button>
          <button type="button" title="Settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-base leading-none text-white transition hover:bg-[#3a3b3b]" onClick={onOpenSettings}><MdSettings className="w-5 h-5" /></button>
          <button type="button" title="Logout" aria-label="Logout" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2f2f] text-base leading-none text-white transition hover:bg-[#3a3b3b]" onClick={onLogout}><MdLogout className="w-5 h-5" /></button>
        </div>
      </header>

      <div ref={messagesViewportRef} className="flex-1 overflow-y-auto bg-[#161717] px-8 py-5">
        <div className="mb-5 flex justify-center">
          <button
            type="button"
            className="rounded-full bg-[#2e2f2f] px-4 py-2 text-xs font-medium text-white/60 transition hover:text-white disabled:opacity-40"
            onClick={onLoadOlder}
            disabled={!hasMoreMessages || loadingOlder}
          >
            {loadingOlder ? "Loading..." : hasMoreMessages ? "Load older messages" : "All messages loaded"}
          </button>
        </div>

        {messagesLoading ? (
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-[#2e2f2f] px-4 py-2 text-xs font-medium text-white/65">
              Loading messages...
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {(() => {
            const groupedMessages = groupConsecutiveImages(messages);
            return groupedMessages.map((group, groupIndex) => {
              if (group.type === "image-group") {
                // Render grouped images
                const firstMessage = group.messages[0];
                const outbound = firstMessage.direction === "outbound";
                // Merge captions from all images in the group
                const captions = group.messages
                  .map(msg => msg.body)
                  .filter(Boolean)
                  .join("\n");
                
                return (
                  <div key={`group-${groupIndex}`} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div 
                      className={`max-w-[72%] rounded-[18px] px-4 py-3 shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition-colors relative ${
                        outbound ? "bg-[#144d37]" : "bg-[#2e2f2f]"
                      }`}
                    >
                      {renderGridImage(group, (media) => setSelectedMediaModal(media))}
                      {captions ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/88">{captions}</p> : null}
                      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-white/35">
                        <span>{formatTime(firstMessage.createdAt)}</span>
                        {outbound ? <span>{renderStatus(firstMessage)}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Render single message
                const message = group.message;
                const outbound = message.direction === "outbound";
                const messageIndexInAll = messages.indexOf(message);
                const isSearchResult = messageQuery && searchResults.includes(messageIndexInAll);
                const isCurrentSearchResult = isSearchResult && searchResults[searchResultIndex] === messageIndexInAll;

                return (
                  <div key={message.id} data-message-id={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div 
                      className={`max-w-[72%] rounded-[18px] px-4 py-3 shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition-colors relative ${
                        isCurrentSearchResult 
                          ? "ring-2 ring-brand-500 " + (outbound ? "bg-[#1a5f41]" : "bg-[#3a4a4a]")
                          : isSearchResult 
                          ? "ring-1 ring-brand-500/50 " + (outbound ? "bg-[#144d37]" : "bg-[#2e2f2f]")
                          : outbound ? "bg-[#144d37]" : "bg-[#2e2f2f]"
                      }`}
                      onMouseEnter={() => setHoveredMessageId(message.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      {message.replyTo ? (
                        <div className="mb-2 rounded-2xl border-l-4 border-brand-500 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
                          <span className="font-semibold text-white">{message.replyTo.direction === "outbound" ? "Anda" : chat.contact.displayName}</span>
                          <p className="mt-1 truncate">{previewReply(message.replyTo)}</p>
                        </div>
                      ) : null}

                      {renderMediaPreviewWithCallback(message, (media) => setSelectedMediaModal(media))}
                      {message.body ? <p className="whitespace-pre-wrap text-sm leading-6 text-white/88">{message.body}</p> : null}

                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/35">
                        <span>{formatTime(message.createdAt)}</span>
                        {outbound ? <span>{renderStatus(message)}</span> : null}
                      </div>

                      {hoveredMessageId === message.id && (
                        <div className="absolute right-2 top-2 flex items-center gap-1">
                          <button
                            type="button"
                            ref={menuTriggerRef}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2e2f2f] text-white/60 transition hover:bg-[#3a3b3b] hover:text-white"
                            onClick={() => setActiveMenuMessageId((current) => (current === message.id ? null : message.id))}
                            title="More options"
                          >
                            <MdMoreVert className="w-5 h-5" />
                          </button>
                          <MessageActionMenu
                            isOpen={activeMenuMessageId === message.id}
                            onClose={() => setActiveMenuMessageId(null)}
                            message={message}
                            onReply={() => setReplyTo(message)}
                            onDelete={() => onDeleteMessage(message.id)}
                            onForward={() => {
                              setForwardingMessageId((current) => (current === message.id ? null : message.id));
                              setForwardTargetChatId("");
                            }}
                            isOutbound={outbound}
                            triggerRef={menuTriggerRef}
                          />
                        </div>
                      )}

                      {forwardingMessageId === message.id ? (
                        <div className="mt-3 flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-3">
                          <select
                            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-[#0b141a] px-3 py-2 text-sm text-white outline-none"
                            value={forwardTargetChatId}
                            onChange={(event) => setForwardTargetChatId(event.target.value)}
                          >
                            <option value="">Select target chat</option>
                            {forwardTargets.map((target) => (
                              <option key={target.id} value={target.id}>
                                {target.contact.displayName}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]" onClick={() => handleForward(message.id)}>Send</button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }
            });
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="shrink-0 bg-[#161717] px-6 py-3" onSubmit={handleSubmit}>
        {replyTo ? (
          <div className="mb-3 flex items-start justify-between rounded-2xl bg-[#2e2f2f] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-100">Reply</p>
              <p className="mt-1 truncate text-sm text-white/55">{previewReply(replyTo)}</p>
            </div>
            <button type="button" className="text-sm text-white/45 hover:text-white" onClick={() => setReplyTo(null)}><MdClose className="w-4 h-4" /></button>
          </div>
        ) : null}

        {pendingFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-3">
            {pendingFiles.map((file, index) => (
              <div key={index} className="relative">
                {file.preview && file.type.startsWith("image/") ? (
                  <img src={file.preview} alt={file.name} className="h-16 w-16 rounded-lg object-cover" />
                ) : file.preview && file.type.startsWith("video/") ? (
                  <video src={file.preview} className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[#2e2f2f] text-sm font-medium text-white/60">
                    {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white transition hover:bg-red-600"
                >
                  <MdClose className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 relative">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#2e2f2f] text-[24px] leading-none text-white/60 transition hover:bg-[#3a3b3b] hover:text-white">
            <MdAdd className="w-5 h-5" />
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
          </label>
          <button
            type="button"
            ref={emojiTriggerRef}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2e2f2f] text-[20px] transition hover:bg-[#3a3b3b]"
            onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
            title="Emoji"
          >
            <MdEmojiEmotions className="w-5 h-5" />
          </button>
          {emojiPickerOpen && (
            <div className="absolute bottom-full left-0 z-50">
              <EmojiPicker
                isOpen={emojiPickerOpen}
                onClose={() => setEmojiPickerOpen(false)}
                onEmojiSelect={handleEmojiSelect}
                triggerRef={emojiTriggerRef}
              />
            </div>
          )}
          <div className="flex flex-1 items-center rounded-[22px] bg-[#2e2f2f] px-4 py-2">
            <textarea
              ref={composerRef}
              rows={1}
              className="min-h-[20px] w-full resize-none overflow-y-auto border-none bg-transparent px-1 py-0.5 text-sm leading-5 text-white outline-none placeholder:text-white/30 disabled:opacity-60"
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
              disabled={busy || uploading}
            />
          </div>
          <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold leading-none text-[#10251a] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || uploading}>
            {busy || uploading ? <SendButtonSpinner /> : <MdSend className="w-5 h-5" />}
          </button>
        </div>
      </form>
      {selectedMediaModal && (
        <MediaPreviewModal
          media={selectedMediaModal}
          onClose={() => setSelectedMediaModal(null)}
        />
      )}
    </section>
  );
});
