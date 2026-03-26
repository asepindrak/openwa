import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

function SessionStatusBadge({ status }) {
  const colors = {
    ready: "bg-brand-500/15 text-brand-100 ring-1 ring-brand-400/20",
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

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
  onCreateSession,
  apiKeys,
  apiKeysLoading,
  apiKeyName,
  apiKeySecret,
  onApiKeyNameChange,
  onCreateApiKey,
  onRevokeApiKey
}) {
  const [copied, setCopied] = useState(false);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8 backdrop-blur-sm">
      <div className="flex h-full max-h-[840px] w-full max-w-[1080px] flex-col overflow-hidden rounded-[32px] bg-[#161717] shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
              <BrandLogo variant="square" alt="OpenWA" className="h-full w-full rounded-xl" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/35">Settings</p>
              <h2 className="mt-2 text-xl font-semibold text-white">OpenWA Devices</h2>
            </div>
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

          <div className="min-h-0 overflow-y-auto px-6 py-5">
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
                  QR code for pairing will appear here when session is connecting.
                </div>
              )}
            </div>

            <form className="mt-5 space-y-3 rounded-[28px] bg-[#161717] p-4" onSubmit={onCreateSession}>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/35">Add device</p>
                <input
                  className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Session name, e.g. Sales Team"
                  value={sessionName}
                  onChange={(event) => onSessionNameChange(event.target.value)}
                  required
                />
              </div>
              <input
                className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                placeholder="WhatsApp number (optional)"
                value={sessionPhone}
                onChange={(event) => onSessionPhoneChange(event.target.value)}
              />
              <button type="submit" className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a]">
                Add WhatsApp Session
              </button>
            </form>

            <div className="mt-5 rounded-[28px] bg-[#161717] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">API Access</p>
                  <h3 className="mt-2 text-base font-semibold text-white">Generate API key</h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">Use with external agents via `X-API-Key` header or `Authorization: Bearer &lt;api-key&gt;`.</p>
                </div>
              </div>

              {apiKeySecret ? (
                <div className="mt-4 rounded-[22px] bg-[#2e2f2f] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-brand-200/80">Shown once</p>
                  <p className="mt-2 break-all font-mono text-sm text-white">{apiKeySecret}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]"
                    onClick={async () => {
                      await navigator.clipboard.writeText(apiKeySecret);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied" : "Copy API key"}
                  </button>
                </div>
              ) : null}

              <form className="mt-4 flex gap-2" onSubmit={onCreateApiKey}>
                <input
                  className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Key name, e.g. OpenClaw Agent"
                  value={apiKeyName}
                  onChange={(event) => onApiKeyNameChange(event.target.value)}
                  required
                />
                <button type="submit" className="shrink-0 rounded-[22px] bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a]">
                  Generate
                </button>
              </form>

              <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                {apiKeysLoading ? <div className="rounded-[22px] bg-[#2e2f2f] px-4 py-6 text-sm text-white/45">Loading API keys...</div> : null}

                {!apiKeysLoading && !apiKeys.length ? (
                  <div className="rounded-[22px] bg-[#2e2f2f] px-4 py-6 text-sm leading-6 text-white/45">
                    No API keys yet. Create one for OpenAPI client, AI agents, or external integrations.
                  </div>
                ) : null}

                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="rounded-[22px] bg-[#2e2f2f] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-white">{apiKey.name}</h4>
                        <p className="mt-1 font-mono text-xs text-white/55">{apiKey.maskedKey}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15"
                        onClick={() => onRevokeApiKey(apiKey.id)}
                      >
                        Revoke
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-white/40">
                      <p>Created: {formatDateTime(apiKey.createdAt)}</p>
                      <p>Last used: {formatDateTime(apiKey.lastUsedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
