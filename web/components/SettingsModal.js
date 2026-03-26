function SessionStatusBadge({ status }) {
  const colors = {
    ready: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20",
    connecting: "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/20",
    disconnected: "bg-white/8 text-white/60 ring-1 ring-white/10",
    error: "bg-red-500/15 text-red-100 ring-1 ring-red-400/20"
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize tracking-[0.08em] ${colors[status] || colors.disconnected}`}>
      {status}
    </span>
  );
}

function initials(label) {
  return String(label || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SessionAvatar({ label }) {
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2e2f2f] text-sm font-semibold text-white">{initials(label)}</div>;
}

export function SettingsModal({
  open,
  sessions,
  activeSessionId,
  onClose,
  onSelect,
  onConnect,
  onDisconnect,
  sessionName,
  sessionPhone,
  onSessionNameChange,
  onSessionPhoneChange,
  onCreateSession
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8 backdrop-blur-sm">
      <div className="flex h-full max-h-[840px] w-full max-w-[1080px] flex-col overflow-hidden rounded-[32px] bg-[#161717] shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-white/35">Settings</p>
            <h2 className="mt-2 text-xl font-semibold text-white">WhatsApp Devices</h2>
          </div>
          <button type="button" className="rounded-full bg-[#2e2f2f] px-4 py-2 text-sm text-white/70 transition hover:bg-[#3a3b3b] hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1.2fr_0.8fr]">
          <div className="min-h-0 px-5 py-5">
            <div className="h-full overflow-y-auto pr-1">
              <div className="space-y-3">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={`w-full rounded-[18px] px-4 py-4 text-left transition ${
                      session.id === activeSessionId
                        ? "bg-[#2e2f2f]"
                        : "bg-transparent hover:bg-white/[0.04]"
                    }`}
                    onClick={() => onSelect(session.id)}
                  >
                    <div className="flex items-start gap-3">
                      <SessionAvatar label={session.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="truncate font-medium text-white">{session.name}</h3>
                          <SessionStatusBadge status={session.status} />
                        </div>
                        <p className="mt-1 text-sm text-white/45">{session.phoneNumber || "Waiting for WhatsApp pairing"}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/30">
                          Transport: {session.transportType === "mock" ? "Mock" : "WhatsApp Web"}
                        </p>
                        {session.lastError ? <p className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-100">{session.lastError}</p> : null}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]"
                        onClick={(event) => {
                          event.stopPropagation();
                          onConnect(session.id);
                        }}
                      >
                        Connect
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl bg-[#2e2f2f] px-4 py-2 text-sm text-white/75"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDisconnect(session.id);
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col px-6 py-5">
            <div className="rounded-[28px] bg-[#161717] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Pairing QR</p>
              {sessions.find((session) => session.id === activeSessionId)?.qrCode ? (
                <div className="mt-4 rounded-[24px] bg-white p-4">
                  <img
                    src={sessions.find((session) => session.id === activeSessionId)?.qrCode}
                    alt="QR Code"
                    className="mx-auto h-56 w-56 rounded-2xl"
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-[24px] bg-[#2e2f2f] px-4 py-16 text-center text-sm leading-6 text-white/40">
                  QR code pairing akan muncul di sini saat session sedang connect.
                </div>
              )}
            </div>

            <form className="mt-5 space-y-3 rounded-[28px] bg-[#161717] p-4" onSubmit={onCreateSession}>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/35">Add device</p>
                <input
                  className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Nama sesi, mis. Sales Team"
                  value={sessionName}
                  onChange={(event) => onSessionNameChange(event.target.value)}
                  required
                />
              </div>
              <input
                className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                placeholder="Nomor WhatsApp (opsional)"
                value={sessionPhone}
                onChange={(event) => onSessionPhoneChange(event.target.value)}
              />
              <button type="submit" className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a]">
                Add WhatsApp Session
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
