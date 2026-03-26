function formatSubtitle(contact) {
  if (contact.lastMessagePreview) {
    return contact.lastMessagePreview;
  }

  return contact.externalId.replace(/@.+$/, "");
}

function initials(name) {
  return String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ContactAvatar({ src, label }) {
  if (src) {
    return <img src={src} alt={label} className="h-11 w-11 rounded-2xl object-cover" />;
  }

  return <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2e2f2f] text-sm font-semibold text-white">{initials(label)}</div>;
}

export function ContactsPanel({ contacts, loading, open, query, onQueryChange, onStartChat, onClose, startingContactId }) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filteredContacts = contacts.filter((contact) =>
    !normalizedQuery
      || [contact.displayName, contact.externalId, contact.lastMessagePreview]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  return (
    <aside className={`flex h-full shrink-0 overflow-hidden bg-[#161717] transition-[width,opacity] duration-300 ${open ? "w-[320px] opacity-100" : "w-0 opacity-0"}`}>
      <div className={`flex h-full w-[320px] min-w-[320px] flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-8"}`}>
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Contacts</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Start new message</h2>
            </div>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2e2f2f] text-xs leading-none text-white/60 transition hover:bg-[#3a3b3b] hover:text-white" onClick={onClose} title="Close contacts" aria-label="Close contacts">
              ×
            </button>
          </div>
          <div className="mt-4 rounded-[22px] bg-[#2e2f2f] px-3 py-2">
            <input
              className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              placeholder="Search contacts"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? <p className="px-3 py-4 text-sm text-white/45">Memuat contacts...</p> : null}
          {!loading && filteredContacts.length === 0 ? <p className="px-3 py-4 text-sm leading-6 text-white/40">Belum ada contact tersinkron. Hubungkan device dan tunggu sinkronisasi WhatsApp selesai.</p> : null}

          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-[16px] bg-transparent px-3 py-3 text-left transition hover:bg-white/[0.05]"
                onClick={() => onStartChat(contact.id)}
              >
                <ContactAvatar src={contact.avatarUrl} label={contact.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-medium text-white">{contact.displayName}</h3>
                    {contact.hasChat ? <span className="rounded-full bg-[#144d37] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Chat</span> : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/40">{formatSubtitle(contact)}</p>
                </div>
                <div className="shrink-0 text-xs text-white/35">
                  {startingContactId === contact.id ? "..." : "+"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
