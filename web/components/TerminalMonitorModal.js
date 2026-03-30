import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export function TerminalMonitorModal({ open, onClose }) {
  const token = useAppStore((s) => s.token);
  const socket = useAppStore((s) => s.socket);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/api/terminal/history", { token });
        if (!mounted) return;
        setItems(data.items || []);
      } catch (err) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [open, token]);

  useEffect(() => {
    if (!socket) return;
    const onResult = (payload) => {
      setItems((cur) => {
        const found = cur.find((i) => i.id === payload.id);
        if (found) {
          return cur.map((i) =>
            i.id === payload.id ? { ...i, status: payload.status } : i,
          );
        }
        return [payload, ...cur];
      });

      if (selected && payload.id === selected) {
        // refresh detail
        (async () => {
          try {
            const d = await apiFetch(`/api/terminal/${payload.id}`, { token });
            setDetail(d.item || null);
          } catch (e) {}
        })();
      }
    };

    socket.on("terminal_result", onResult);
    socket.on("terminal_request", onResult);

    return () => {
      try {
        socket.off("terminal_result", onResult);
        socket.off("terminal_request", onResult);
      } catch (e) {}
    };
  }, [socket, token, selected]);

  const handleSelect = async (id) => {
    setSelected(id);
    setLoadingDetail(true);
    try {
      const data = await apiFetch(`/api/terminal/${id}`, { token });
      setDetail(data.item || null);
    } catch (err) {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshHistory = async () => {
    try {
      const data = await apiFetch("/api/terminal/history", { token });
      setItems(data.items || []);
    } catch (e) {
      // ignore
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await apiFetch(`/api/terminal/${selected}/approve`, {
        method: "POST",
        token,
      });
      const d = await apiFetch(`/api/terminal/${selected}`, { token });
      setDetail(d.item || null);
      await refreshHistory();
    } catch (e) {
      // ignore
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!selected) return;
    if (!window.confirm("Are you sure you want to deny this terminal request?"))
      return;
    setProcessing(true);
    try {
      await apiFetch(`/api/terminal/${selected}/deny`, {
        method: "POST",
        token,
      });
      const d = await apiFetch(`/api/terminal/${selected}`, { token });
      setDetail(d.item || null);
      await refreshHistory();
    } catch (e) {
      // ignore
    } finally {
      setProcessing(false);
    }
  };

  const handleRerun = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await apiFetch(`/api/terminal/${selected}/rerun`, {
        method: "POST",
        token,
      });
      // refresh details + history after rerun
      const d = await apiFetch(`/api/terminal/${selected}`, { token });
      setDetail(d.item || null);
      await refreshHistory();
    } catch (e) {
      // ignore
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8">
      <div className="flex h-[80vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[20px] bg-[#161717] p-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-semibold text-white">Terminal Monitor</h3>
          <div className="flex gap-2">
            <button
              className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/80"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-3 flex h-full gap-4">
          <div className="w-1/3 overflow-auto rounded-lg bg-[#0f1111] p-3">
            {loading ? (
              <div className="text-white/50">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-white/50">No terminal records yet.</div>
            ) : (
              items.map((it) => (
                <div
                  key={it.id}
                  className={`mb-2 cursor-pointer rounded-md p-2 ${selected === it.id ? "bg-white/5" : "hover:bg-white/3"}`}
                  onClick={() => handleSelect(it.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white/90 truncate">
                      {it.command}
                    </div>
                    <div className="text-xs text-white/60">
                      {new Date(it.requestedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    Status: {it.status}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex-1 overflow-auto rounded-lg bg-[#0f1111] p-4">
            {loadingDetail ? (
              <div className="text-white/50">Loading details...</div>
            ) : !detail ? (
              <div className="text-white/50">
                Select a record to view details.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">
                      {detail.command}
                    </div>
                    <div className="text-xs text-white/60">
                      Requested: {new Date(detail.requestedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-white/60">
                      Executed:{" "}
                      {detail.executedAt
                        ? new Date(detail.executedAt).toLocaleString()
                        : "N/A"}
                    </div>
                    <div className="text-xs text-white/60">
                      Status: {detail.status}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full bg-yellow-600 px-3 py-1 text-sm text-white"
                      onClick={handleRerun}
                      disabled={processing}
                    >
                      Rerun
                    </button>

                    {detail.status === "pending" && (
                      <>
                        <button
                          className="rounded-full bg-emerald-600 px-3 py-1 text-sm text-white"
                          onClick={handleApprove}
                          disabled={processing}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-full bg-red-600 px-3 py-1 text-sm text-white"
                          onClick={handleDeny}
                          disabled={processing}
                        >
                          Deny
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-sm text-white/70">Stdout</p>
                  <pre className="max-h-48 overflow-auto rounded bg-black/60 p-3 text-xs text-white/70">
                    {detail.result?.stdout || "(no stdout)"}
                  </pre>
                </div>

                <div>
                  <p className="mb-2 text-sm text-white/70">Stderr</p>
                  <pre className="max-h-48 overflow-auto rounded bg-black/60 p-3 text-xs text-white/70">
                    {detail.result?.stderr || "(no stderr)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TerminalMonitorModal;
