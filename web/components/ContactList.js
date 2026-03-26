function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function initials(name) {
  return String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ src, label }) {
  if (src) {
    return <img src={src} alt={label} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />;
  }

  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2e2f2f] text-sm font-semibold text-white">{initials(label)}</div>;
}

export function ContactList({ chats, activeChatId, onSelectChat, currentUser, loading, query, onQueryChange }) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filteredChats = chats.filter((chat) =>
    !normalizedQuery
      || [chat.contact.displayName, chat.contact.lastMessagePreview, chat.title]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col bg-[#161717]">
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-sm font-bold text-[#10251a]">
            {initials(currentUser?.name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-white">{currentUser?.name || "OpenWA User"}</h2>
            <p className="text-sm text-white/40">All conversations</p>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] bg-[#2e2f2f] px-3 py-2">
          <input
            className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            placeholder="Search conversation"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? <p className="px-3 py-4 text-sm text-white/45">Memuat percakapan...</p> : null}
        {!loading && filteredChats.length === 0 ? <p className="px-3 py-4 text-sm leading-6 text-white/40">Belum ada percakapan tersinkron. Connect device untuk memuat semua chat terbaru.</p> : null}

        <div className="space-y-2">
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className={`flex w-full items-start gap-3 rounded-[16px] px-4 py-3 text-left transition ${
                chat.id === activeChatId
                  ? "bg-[#2e2f2f]"
                  : "bg-transparent hover:bg-white/[0.05]"
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <Avatar src={chat.contact.avatarUrl} label={chat.contact.displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate font-medium text-white">{chat.contact.displayName}</h3>
                  <span className="shrink-0 text-[11px] text-white/35">{formatTime(chat.contact.lastMessageAt || chat.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="truncate text-sm text-white/42">{chat.contact.lastMessagePreview || "Belum ada pesan"}</p>
                  {chat.contact.unreadCount ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-[#10251a]">
                      {chat.contact.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
