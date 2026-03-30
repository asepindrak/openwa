import { useEffect, useState } from "react";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export function ChatProfileModal({ open, chat, onClose }) {
  const token = useAppStore((s) => s.token);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [persona, setPersona] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(chat?.contact?.displayName || "");
    setAvatarUrl(chat?.contact?.avatarUrl || "");
    setPersona(chat?.contact?.persona || "");
  }, [open, chat]);

  const isAssistant = chat?.contact?.externalId === "openwa:assistant";

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) return alert("Authentication required.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/media", {
        method: "POST",
        token,
        formData: fd,
      });
      const mediaUrl = `${getApiBaseUrl()}/${res.mediaFile.relativePath}`;

      if (isAssistant) {
        const updated = await apiFetch("/api/assistant", {
          method: "PUT",
          token,
          body: { avatarUrl: mediaUrl },
        });
        const a = updated.assistant || {};
        setAvatarUrl(a.avatarUrl || mediaUrl);

        // update cached chats in store to reflect new avatar immediately
        const state = useAppStore.getState();
        const nextChats = (state.chats || []).map((c) =>
          c.contact?.externalId === "openwa:assistant"
            ? {
                ...c,
                contact: { ...c.contact, avatarUrl: a.avatarUrl || mediaUrl },
              }
            : c,
        );
        useAppStore.setState({ chats: nextChats });
      } else {
        setAvatarUrl(mediaUrl);
      }
    } catch (err) {
      alert(err.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!isAssistant) return onClose();
    if (!token) return alert("Authentication required.");
    setSaving(true);
    try {
      const payload = { displayName, persona, avatarUrl };
      const updated = await apiFetch("/api/assistant", {
        method: "PUT",
        token,
        body: payload,
      });
      const a = updated.assistant || {};

      const state = useAppStore.getState();
      const nextChats = (state.chats || []).map((c) =>
        c.contact?.externalId === "openwa:assistant"
          ? {
              ...c,
              contact: {
                ...c.contact,
                displayName: a.displayName,
                avatarUrl: a.avatarUrl,
                persona: a.persona,
              },
            }
          : c,
      );
      useAppStore.setState({ chats: nextChats });

      onClose();
    } catch (err) {
      alert(err.message || "Failed to save assistant");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-[#161717] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Profile</h3>
          <button
            type="button"
            className="rounded-full bg-[#2e2f2f] px-3 py-1 text-sm text-white/70"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-[#2e2f2f]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white">
                  {(displayName || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm text-white/60">
                {chat?.contact?.externalId}
              </p>
              <p className="mt-1 font-medium text-white">
                {chat?.contact?.displayName}
              </p>
            </div>
          </div>

          <div className="mt-4">
            {isAssistant ? (
              <>
                <label className="block text-xs text-white/50">
                  Display name
                </label>
                <input
                  className="mt-1 w-full rounded-[10px] bg-[#2e2f2f] px-3 py-2 text-sm text-white outline-none"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />

                <label className="mt-3 block text-xs text-white/50">
                  Avatar
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  {uploading ? (
                    <span className="text-sm text-white/50">Uploading...</span>
                  ) : null}
                </div>

                <label className="mt-3 block text-xs text-white/50">
                  Persona (system prompt)
                </label>
                <textarea
                  className="mt-1 w-full rounded-[10px] bg-[#2e2f2f] px-3 py-2 text-sm text-white outline-none"
                  rows={4}
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                />

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3 space-y-2 text-sm text-white/50">
                <p>
                  <strong>Name:</strong> {chat?.contact?.displayName}
                </p>
                <p>
                  <strong>External ID:</strong> {chat?.contact?.externalId}
                </p>
                {chat?.contact?.lastMessageAt ? (
                  <p>
                    <strong>Last message:</strong>{" "}
                    {new Date(chat.contact.lastMessageAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
