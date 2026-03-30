import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export function ToolsEditorModal({ open, onClose }) {
  const token = useAppStore((s) => s.token);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/api/agent/tools", { token });
        if (!mounted) return;
        setContent(data.content || "");
      } catch (err) {
        alert(err.message || "Failed to load tools file");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, token]);

  if (!open) return null;

  const handleSaveReplace = async () => {
    if (!token) return alert("Not authenticated");
    setSaving(true);
    try {
      await apiFetch("/api/agent/tools", {
        method: "PUT",
        token,
        body: { action: "replace", content },
      });
      alert("TOOLS.md replaced");
      onClose();
    } catch (err) {
      alert(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAppend = async () => {
    if (!token) return alert("Not authenticated");
    setSaving(true);
    try {
      await apiFetch("/api/agent/tools", {
        method: "PUT",
        token,
        body: { action: "append", content },
      });
      alert("Appended to TOOLS.md");
      onClose();
    } catch (err) {
      alert(err.message || "Failed to append");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8">
      <div className="flex h-[80vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[20px] bg-[#161717] p-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-semibold text-white">Edit TOOLS.md</h3>
          <div className="flex gap-2">
            <button
              className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/80"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-white/50">
              Loading...
            </div>
          ) : (
            <textarea
              className="h-full w-full resize-none rounded-lg bg-[#0f1111] p-3 text-sm text-white outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            className="rounded-2xl bg-white/5 px-4 py-2 text-sm text-white/80"
            onClick={handleAppend}
            disabled={saving}
          >
            {saving ? "Saving..." : "Append"}
          </button>
          <button
            className="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-[#10251a]"
            onClick={handleSaveReplace}
            disabled={saving}
          >
            {saving ? "Saving..." : "Replace"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ToolsEditorModal;
