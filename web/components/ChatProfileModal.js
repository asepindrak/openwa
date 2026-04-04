import { useEffect, useRef, useState } from "react";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { MdCheckCircle, MdCloudUpload, MdImage } from "react-icons/md";

export function ChatProfileModal({ open, chat, onClose }) {
  const token = useAppStore((s) => s.token);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [persona, setPersona] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedAvatarName, setSelectedAvatarName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(chat?.contact?.displayName || "");
    setAvatarUrl(chat?.contact?.avatarUrl || "");
    setPersona(chat?.contact?.persona || "");
    setSelectedAvatarName("");
  }, [open, chat]);

  const externalId = String(chat?.contact?.externalId || "");
  const isAssistant = externalId.startsWith("openwa:assistant");
  const isSingletonAssistant = externalId === "openwa:assistant";

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) return alert("Authentication required.");
    setSelectedAvatarName(file.name);
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
        if (isSingletonAssistant) {
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
          // per-instance assistant: update the contact via contacts API
          const resp = await apiFetch(`/api/contacts/${chat.contact.id}`, {
            method: "PUT",
            token,
            body: { avatarUrl: mediaUrl },
          });
          const updatedChat = resp.chat;
          if (updatedChat && updatedChat.id) {
            const state = useAppStore.getState();
            const nextChats = (state.chats || []).map((c) =>
              c.id === updatedChat.id ? updatedChat : c,
            );
            useAppStore.setState({ chats: nextChats });
            setAvatarUrl(updatedChat.contact?.avatarUrl || mediaUrl);
          } else {
            setAvatarUrl(mediaUrl);
          }
        }
      } else {
        setAvatarUrl(mediaUrl);
      }
    } catch (err) {
      alert(err.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!isAssistant) return onClose();
    if (!token) return alert("Authentication required.");
    setSaving(true);
    try {
      const payload = { displayName, persona, avatarUrl };
      if (isSingletonAssistant) {
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
      } else {
        const resp = await apiFetch(`/api/contacts/${chat.contact.id}`, {
          method: "PUT",
          token,
          body: payload,
        });
        const updatedChat = resp.chat;
        if (updatedChat && updatedChat.id) {
          const state = useAppStore.getState();
          const nextChats = (state.chats || []).map((c) =>
            c.id === updatedChat.id ? updatedChat : c,
          );
          useAppStore.setState({ chats: nextChats });
        }

        onClose();
      }
    } catch (err) {
      alert(err.message || "Failed to save assistant");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#161717] shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#161717]/95 px-5 py-4 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white">Profile</h3>
          <button
            type="button"
            className="rounded-full bg-[#2e2f2f] px-3 py-1 text-sm text-white/70"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
                <div className="mt-2 rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3">
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#2e2f2f] shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/70">
                          <MdImage className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                        Preview
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">
                        Update avatar image
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/50">
                        Pilih gambar persegi agar hasil avatar lebih rapi.
                        Format umum seperti JPG, PNG, dan WEBP didukung.
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#111b21] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading || saving}
                        >
                          <MdCloudUpload className="h-4 w-4" />
                          {uploading ? "Uploading..." : "Choose Image"}
                        </button>

                        {selectedAvatarName ? (
                          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                            <MdCheckCircle className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {selectedAvatarName}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-black/20 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/85">
                          {uploading
                            ? "Uploading avatar image"
                            : selectedAvatarName ||
                              "Belum ada file baru yang dipilih"}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {uploading
                            ? "Avatar akan diperbarui otomatis setelah upload selesai."
                            : avatarUrl
                              ? "Avatar saat ini tetap dipakai sampai Anda memilih gambar baru."
                              : "Klik tombol di atas untuk memilih gambar avatar."}
                        </p>
                      </div>

                      <div className="rounded-full bg-white/5 p-2 text-white/55">
                        <MdImage className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
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

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-[#161717]/95 px-5 py-4 backdrop-blur-sm">
          <button
            type="button"
            className="rounded-2xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
          {isAssistant ? (
            <button
              type="button"
              className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
