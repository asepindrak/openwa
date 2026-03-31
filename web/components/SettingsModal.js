import { useState, useEffect } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ToolsEditorModal } from "@/components/ToolsEditorModal";
import TerminalMonitorModal from "@/components/TerminalMonitorModal";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function SessionStatusBadge({ status }) {
  const colors = {
    ready: "bg-brand-500/15 text-brand-100 ring-1 ring-brand-400/20",
    connecting: "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/20",
    disconnected: "bg-white/8 text-white/60 ring-1 ring-white/10",
    error: "bg-red-500/15 text-red-100 ring-1 ring-red-400/20",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize tracking-[0.08em] ${colors[status] || colors.disconnected}`}
    >
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
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2e2f2f] text-sm font-semibold text-white">
      {initials(label)}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  onClearSession,
  onDeleteSession,
  connectLoading,
  qrLoading,
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
  onRevokeApiKey,
  revokingKeyId,
  webhookUrl,
  webhookApiKey,
  onWebhookUrlChange,
  onWebhookApiKeyChange,
  onSaveWebhook,
  onDeleteWebhook,
  webhookLoading,
}) {
  const [copied, setCopied] = useState(false);
  const token = useAppStore((s) => s.token);
  const setActiveChat = useAppStore((s) => s.setActiveChat);
  const upsertChat = useAppStore((s) => s.upsertChat);
  const terminalAutoApproveAll = useAppStore((s) => s.terminalAutoApproveAll);
  const setTerminalAutoApproveAll = useAppStore(
    (s) => s.setTerminalAutoApproveAll,
  );
  const defaultAiProviderId = useAppStore((s) => s.defaultAiProviderId);
  const defaultAiModel = useAppStore((s) => s.defaultAiModel);
  const setDefaultAiProvider = useAppStore((s) => s.setDefaultAiProvider);
  const setDefaultAiModel = useAppStore((s) => s.setDefaultAiModel);

  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerHost, setProviderHost] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [addingProvider, setAddingProvider] = useState(false);
  const [modelsMap, setModelsMap] = useState({});
  const [modelsLoadingId, setModelsLoadingId] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [creatingAssistant, setCreatingAssistant] = useState(false);
  const [activeTab, setActiveTab] = useState("devices");

  const activeProvider = providers.find((p) => p.id === defaultAiProviderId);
  const activeModelName =
    defaultAiModel && modelsMap[defaultAiProviderId]
      ? modelsMap[defaultAiProviderId].find((m) => m.id === defaultAiModel)
          ?.name || defaultAiModel
      : defaultAiModel || null;

  function providerHint(key) {
    if (!key) return "";
    switch (String(key).toLowerCase()) {
      case "openai":
        return "OpenAI: provide an API key (platform.openai.com). Host is optional.";
      case "anthropic":
        return "Anthropic: provide an API key. Default model is typically `claude-2`.";
      case "ollama":
        return "Ollama: provide the local host (e.g. http://localhost:11434) and model name to use.";
      case "openrouter":
        return "OpenRouter: provide host or API key and optionally a default model.";
      default:
        return "Provide connection details (API key, host, default model).";
    }
  }

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      if (!token) return;
      setProvidersLoading(true);
      try {
        const data = await apiFetch("/api/ai-providers", { token });
        if (!mounted) return;
        setProviders(data.providers || []);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setProvidersLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, token]);

  const handleCreateProvider = async (e) => {
    e.preventDefault();
    if (!token) return;
    setAddingProvider(true);
    try {
      const cfg = {};
      if (providerApiKey && providerApiKey.trim())
        cfg.apiKey = providerApiKey.trim();
      if (providerHost && providerHost.trim()) cfg.host = providerHost.trim();
      if (providerModel && providerModel.trim())
        cfg.model = providerModel.trim();

      const result = await apiFetch("/api/ai-providers", {
        method: "POST",
        token,
        body: { provider: providerKey, name: providerName, config: cfg },
      });

      setProviders((p) => [result.provider, ...p]);
      setProviderName("");
      setProviderKey("");
      setProviderApiKey("");
      setProviderHost("");
      setProviderModel("");
      setShowApiKey(false);
    } catch (err) {
      alert(err.message || "Failed to create provider");
    } finally {
      setAddingProvider(false);
    }
  };

  const handleDeleteProvider = async (id) => {
    if (!token) return;
    if (!confirm("Delete this provider?")) return;
    try {
      await apiFetch(`/api/ai-providers/${id}`, { method: "DELETE", token });
      setProviders((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete provider");
    }
  };

  const handleFetchModels = async (id) => {
    if (!token) return;
    setModelsLoadingId(id);
    try {
      const data = await apiFetch(`/api/ai-providers/${id}/models`, { token });
      setModelsMap((m) => ({ ...m, [id]: data.models || [] }));
    } catch (err) {
      alert(err.message || "Failed to fetch models");
    } finally {
      setModelsLoadingId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8 backdrop-blur-sm">
        <div className="flex h-full max-h-[840px] w-full max-w-[1080px] flex-col overflow-hidden rounded-[32px] bg-[#161717] shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                <BrandLogo
                  variant="square"
                  alt="OpenWA"
                  className="h-full w-full rounded-xl"
                />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-white/35">
                  Settings
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  OpenWA Devices
                </h2>
                <div className="mt-1 text-sm text-white/60">
                  <span className="font-medium text-white/85">AI:</span>{" "}
                  {activeProvider ? (
                    <span>
                      {activeProvider.name} ({activeProvider.provider})
                      {activeModelName ? ` — ${activeModelName}` : ""}
                    </span>
                  ) : (
                    <span>None active</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-2xl bg-[#2e2f2f] px-3 py-1 text-sm text-white/70 transition hover:bg-[#3a3b3b] hover:text-white"
                onClick={async () => {
                  if (!token) return;
                  if (!confirm("Start a new Assistant conversation?")) return;
                  setCreatingAssistant(true);
                  try {
                    const data = await apiFetch("/api/assistant/sessions", {
                      method: "POST",
                      token,
                      body: {},
                    });
                    const chat = data.chat;
                    if (chat && chat.id) {
                      upsertChat(chat);
                      setActiveChat(chat.id);
                      onClose();
                    }
                  } catch (err) {
                    alert(err.message || "Failed to create assistant session");
                  } finally {
                    setCreatingAssistant(false);
                  }
                }}
                disabled={creatingAssistant}
              >
                {creatingAssistant ? "Creating..." : "New Assistant"}
              </button>

              <button
                type="button"
                className="rounded-2xl bg-[#2e2f2f] px-3 py-1 text-sm text-white/70 transition hover:bg-[#3a3b3b] hover:text-white"
                onClick={() => setToolsOpen(true)}
              >
                Edit Tools
              </button>

              <button
                type="button"
                className="rounded-2xl bg-[#2e2f2f] px-3 py-1 text-sm text-white/70 transition hover:bg-[#3a3b3b] hover:text-white"
                onClick={() => setTerminalOpen(true)}
              >
                Terminal Monitor
              </button>

              <button
                type="button"
                className="rounded-full bg-[#2e2f2f] px-4 py-2 text-sm text-white/70 transition hover:bg-[#3a3b3b] hover:text-white"
                onClick={onClose}
              >
                Close
              </button>
            </div>
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
                            <h3 className="truncate font-medium text-white">
                              {session.name}
                            </h3>
                            <SessionStatusBadge status={session.status} />
                          </div>
                          <p className="mt-1 text-sm text-white/45">
                            {session.phoneNumber ||
                              "Waiting for WhatsApp pairing"}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/30">
                            Transport:{" "}
                            {session.transportType === "mock"
                              ? "Mock"
                              : "WhatsApp Web"}
                          </p>
                          {session.lastError ? (
                            <p className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-100">
                              {session.lastError}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                          type="button"
                          className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a] disabled:opacity-60"
                          disabled={
                            !!connectLoading && connectLoading === session.id
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onConnect(session.id);
                          }}
                        >
                          {connectLoading === session.id
                            ? "Connecting..."
                            : "Connect"}
                        </button>

                        <button
                          type="button"
                          className="rounded-2xl bg-[#2e2f2f] px-4 py-2 text-sm text-white/75 disabled:opacity-60"
                          disabled={
                            !!connectLoading && connectLoading === session.id
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onDisconnect(session.id);
                          }}
                        >
                          {connectLoading === session.id
                            ? "Disconnecting..."
                            : "Disconnect"}
                        </button>

                        <button
                          type="button"
                          className="rounded-2xl bg-yellow-700 px-4 py-2 text-sm text-white/90"
                          onClick={(event) => {
                            event.stopPropagation();
                            onClearSession(session.id);
                          }}
                        >
                          Clear Session
                        </button>

                        <button
                          type="button"
                          className="rounded-2xl bg-red-700 px-4 py-2 text-sm text-white/90"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                        >
                          Delete Device
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    activeTab === "devices"
                      ? "bg-white/5 text-white"
                      : "bg-transparent text-white/60 hover:bg-white/[0.04]"
                  }`}
                  onClick={() => setActiveTab("devices")}
                >
                  Devices
                </button>

                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    activeTab === "api"
                      ? "bg-white/5 text-white"
                      : "bg-transparent text-white/60 hover:bg-white/[0.04]"
                  }`}
                  onClick={() => setActiveTab("api")}
                >
                  API Access
                </button>

                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    activeTab === "webhooks"
                      ? "bg-white/5 text-white"
                      : "bg-transparent text-white/60 hover:bg-white/[0.04]"
                  }`}
                  onClick={() => setActiveTab("webhooks")}
                >
                  Webhooks
                </button>

                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    activeTab === "ai"
                      ? "bg-white/5 text-white"
                      : "bg-transparent text-white/60 hover:bg-white/[0.04]"
                  }`}
                  onClick={() => setActiveTab("ai")}
                >
                  AI Providers
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    activeTab === "advanced"
                      ? "bg-white/5 text-white"
                      : "bg-transparent text-white/60 hover:bg-white/[0.04]"
                  }`}
                  onClick={() => setActiveTab("advanced")}
                >
                  Advanced
                </button>
              </div>

              {activeTab === "devices" && (
                <>
                  <div className="rounded-[28px] bg-[#161717] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                      Pairing QR
                    </p>
                    {qrLoading ? (
                      <div className="mt-4 rounded-[24px] bg-[#2e2f2f] px-4 py-16 text-center text-sm leading-6 text-white/40">
                        Loading QR code...
                      </div>
                    ) : sessions.find(
                        (session) => session.id === activeSessionId,
                      )?.qrCode ? (
                      <div className="mt-4 rounded-[24px] bg-white p-4">
                        <img
                          src={
                            sessions.find(
                              (session) => session.id === activeSessionId,
                            )?.qrCode
                          }
                          alt="QR Code"
                          className="mx-auto h-56 w-56 rounded-2xl"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[24px] bg-[#2e2f2f] px-4 py-16 text-center text-sm leading-6 text-white/40">
                        QR code for pairing will appear here when session is
                        connecting.
                      </div>
                    )}
                  </div>

                  <form
                    className="mt-5 space-y-3 rounded-[28px] bg-[#161717] p-4"
                    onSubmit={onCreateSession}
                  >
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/35">
                        Add device
                      </p>
                      <input
                        className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="Session name, e.g. Sales Team"
                        value={sessionName}
                        onChange={(event) =>
                          onSessionNameChange(event.target.value)
                        }
                        required
                      />
                    </div>
                    <input
                      className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                      placeholder="WhatsApp number (optional)"
                      value={sessionPhone}
                      onChange={(event) =>
                        onSessionPhoneChange(event.target.value)
                      }
                    />
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a]"
                    >
                      Add WhatsApp Session
                    </button>
                  </form>
                </>
              )}

              {activeTab === "api" && (
                <div className="rounded-[28px] bg-[#161717] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                        API Access
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-white">
                        Generate API key
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-white/45">
                        Use with external agents via `X-API-Key` header or
                        `Authorization: Bearer &lt;api-key&gt;`.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-white/45">
                        Webhooks: forward incoming messages to your endpoint.
                        See the{" "}
                        <a
                          href="/docs/readme#webhooks"
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 font-medium text-brand-300 underline"
                        >
                          webhook documentation
                        </a>{" "}
                        for payload details and agent integration.
                      </p>
                    </div>
                  </div>

                  {apiKeySecret ? (
                    <div className="mt-4 rounded-[22px] bg-[#2e2f2f] p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-brand-200/80">
                        Shown once
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-white">
                        {apiKeySecret}
                      </p>
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
                      onChange={(event) =>
                        onApiKeyNameChange(event.target.value)
                      }
                      required
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-[22px] bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a]"
                      disabled={apiKeysLoading}
                    >
                      {apiKeysLoading ? "Generating..." : "Generate"}
                    </button>
                  </form>

                  <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                    {apiKeysLoading ? (
                      <div className="rounded-[22px] bg-[#2e2f2f] px-4 py-6 text-sm text-white/45">
                        Loading API keys...
                      </div>
                    ) : null}

                    {!apiKeysLoading && !apiKeys.length ? (
                      <div className="rounded-[22px] bg-[#2e2f2f] px-4 py-6 text-sm leading-6 text-white/45">
                        No API keys yet. Create one for OpenAPI client, AI
                        agents, or external integrations.
                      </div>
                    ) : null}

                    {apiKeys.map((apiKey) => (
                      <div
                        key={apiKey.id}
                        className="rounded-[22px] bg-[#2e2f2f] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-white">
                              {apiKey.name}
                            </h4>
                            <p className="mt-1 font-mono text-xs text-white/55">
                              {apiKey.maskedKey}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15"
                            onClick={() => onRevokeApiKey(apiKey.id)}
                            disabled={
                              apiKeysLoading || revokingKeyId === apiKey.id
                            }
                          >
                            {revokingKeyId === apiKey.id
                              ? "Revoking..."
                              : "Revoke"}
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
              )}

              {activeTab === "webhooks" && (
                <div className="rounded-[28px] bg-[#161717] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                    Webhooks
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    Incoming message webhook
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Forward incoming messages to this endpoint. The runtime will
                    POST a JSON payload and include header{" "}
                    <span className="font-mono">x-openwa-webhook-key</span> with
                    the value you provide.
                  </p>

                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onSaveWebhook();
                    }}
                  >
                    <input
                      className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                      placeholder="https://example.com/openwa-webhook"
                      value={webhookUrl || ""}
                      onChange={(e) => onWebhookUrlChange(e.target.value)}
                    />
                    <input
                      className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                      placeholder="Optional webhook API key (sent as x-openwa-webhook-key)"
                      value={webhookApiKey || ""}
                      onChange={(e) => onWebhookApiKeyChange(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a]"
                        disabled={webhookLoading}
                      >
                        {webhookLoading ? "Saving..." : "Save webhook"}
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl bg-red-700 px-4 py-3 text-sm text-white/90"
                        onClick={() => onDeleteWebhook()}
                        disabled={webhookLoading}
                      >
                        {webhookLoading ? "Removing..." : "Remove webhook"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === "ai" && (
                <div className="rounded-[28px] bg-[#161717] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                    AI Providers
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    Manage LLM providers
                  </h3>
                  <div className="mt-2">
                    <button
                      type="button"
                      className="rounded-2xl bg-white/5 px-3 py-2 text-sm font-medium text-white/80"
                      onClick={() => setToolsOpen(true)}
                    >
                      Edit Assistant Tools
                    </button>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Add provider configs for OpenAI, Anthropic, Ollama,
                    OpenRouter, then fetch available models.
                  </p>

                  <form
                    className="mt-4 space-y-3"
                    onSubmit={handleCreateProvider}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        className="col-span-2 w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="Provider name (e.g. My OpenAI)"
                        autoComplete="off"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        required
                      />
                      <select
                        className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none"
                        value={providerKey}
                        onChange={(e) => setProviderKey(e.target.value)}
                        required
                      >
                        <option value="">Select provider</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="ollama">Ollama</option>
                        <option value="openrouter">OpenRouter</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                          placeholder="API key (sensitive, optional)"
                          value={providerApiKey}
                          autoComplete="off"
                          onChange={(e) => setProviderApiKey(e.target.value)}
                          type={showApiKey ? "text" : "password"}
                        />
                        <button
                          type="button"
                          className="rounded-[22px] bg-white/5 px-4 py-3 text-sm text-white/70"
                          onClick={() => setShowApiKey((s) => !s)}
                        >
                          {showApiKey ? "Hide" : "Show"}
                        </button>
                      </div>

                      <input
                        className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="Host (e.g. http://localhost:11434)"
                        value={providerHost}
                        onChange={(e) => setProviderHost(e.target.value)}
                      />
                      <input
                        className="w-full rounded-[22px] bg-[#2e2f2f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="Default model (optional)"
                        value={providerModel}
                        onChange={(e) => setProviderModel(e.target.value)}
                      />
                      <p className="text-xs text-white/45">
                        {providerHint(providerKey)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-[#10251a] disabled:opacity-60"
                        disabled={addingProvider}
                        aria-busy={addingProvider}
                      >
                        {addingProvider ? "Adding..." : "Add provider"}
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 max-h-[200px] space-y-3 overflow-y-auto pr-1">
                    {providersLoading ? (
                      <div className="rounded-[22px] bg-[#2e2f2f] px-4 py-6 text-sm text-white/45">
                        Loading providers...
                      </div>
                    ) : null}

                    {!providersLoading && !providers.length ? (
                      <div className="rounded-[22px] bg-[#2e2f2f] px-4 py-6 text-sm leading-6 text-white/45">
                        No providers configured.
                      </div>
                    ) : null}

                    {providers.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-[22px] bg-[#2e2f2f] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-white">
                              {p.name}
                            </h4>
                            <p className="mt-1 text-xs text-white/55">
                              {p.provider}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80"
                              onClick={() => handleFetchModels(p.id)}
                              disabled={modelsLoadingId === p.id}
                            >
                              {modelsLoadingId === p.id
                                ? "Fetching..."
                                : "Fetch models"}
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-medium text-white/80"
                              onClick={() => handleDeleteProvider(p.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-white/40">
                          <p>Created: {formatDateTime(p.createdAt)}</p>
                        </div>

                        {modelsMap[p.id] && modelsMap[p.id].length ? (
                          <div className="mt-3 grid gap-2">
                            <p className="text-xs text-white/45">Models:</p>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <div className="flex-1">
                                <select
                                  className="w-full rounded-[10px] bg-[#0f1111] px-3 py-2 text-sm text-white outline-none"
                                  value={
                                    defaultAiProviderId === p.id &&
                                    defaultAiModel
                                      ? defaultAiModel
                                      : ""
                                  }
                                  onChange={async (e) => {
                                    const modelId = e.target.value || null;
                                    try {
                                      await setDefaultAiProvider(p.id);
                                      await setDefaultAiModel(modelId);
                                    } catch (err) {
                                      // ignore
                                    }
                                  }}
                                >
                                  <option value="">
                                    Select model (set as default)
                                  </option>
                                  {modelsMap[p.id].map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name || m.id}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                {defaultAiProviderId === p.id ? (
                                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">
                                    Active
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/80"
                                    onClick={async () => {
                                      try {
                                        await setDefaultAiProvider(p.id);
                                      } catch (err) {}
                                    }}
                                  >
                                    Set active
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "advanced" && (
                <div className="rounded-[28px] bg-[#161717] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                    Advanced
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    Terminal auto-approve
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    When enabled, terminal commands requested with approvalMode
                    "auto" will be executed immediately without checking the
                    host allowlist. Use with caution.
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">
                        Auto-approve terminal commands
                      </div>
                      <div className="text-xs text-white/45">
                        Bypass OPENWA_TERMINAL_ALLOWLIST and allow auto
                        execution of any command.
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-sm ${terminalAutoApproveAll ? "bg-emerald-600 text-white" : "bg-white/5 text-white/60"}`}
                      onClick={() =>
                        setTerminalAutoApproveAll(!terminalAutoApproveAll)
                      }
                    >
                      {terminalAutoApproveAll ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ToolsEditorModal open={toolsOpen} onClose={() => setToolsOpen(false)} />
      <TerminalMonitorModal
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
      />
    </>
  );
}
