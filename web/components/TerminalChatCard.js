import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function statusTone(status) {
  if (status === "completed")
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/20";
  if (status === "failed")
    return "bg-red-500/15 text-red-200 border-red-400/20";
  if (status === "pending")
    return "bg-amber-500/15 text-amber-200 border-amber-400/20";
  if (status === "running")
    return "bg-sky-500/15 text-sky-200 border-sky-400/20";
  if (status === "denied")
    return "bg-zinc-500/20 text-zinc-200 border-white/10";
  return "bg-white/10 text-white/75 border-white/10";
}

export function TerminalChatCard({
  terminalId,
  fallbackBody,
  onReplaceTerminalId,
}) {
  const token = useAppStore((s) => s.token);
  const terminalRecord = useAppStore((s) => s.terminalRecordsById[terminalId]);
  const upsertTerminalRecord = useAppStore((s) => s.upsertTerminalRecord);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let active = true;
    if (!terminalId || !token || terminalRecord) return undefined;

    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`/api/terminal/${terminalId}`, { token });
        if (active && data?.item) {
          upsertTerminalRecord(data.item);
        }
      } catch (error) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [terminalId, token, terminalRecord, upsertTerminalRecord]);

  const detail = terminalRecord;
  const status = detail?.status || (loading ? "loading" : "unknown");
  const badgeClass = useMemo(() => statusTone(status), [status]);

  const refreshRecord = async (id) => {
    const targetId = id || terminalId;
    if (!targetId || !token) return null;
    const data = await apiFetch(`/api/terminal/${targetId}`, { token });
    if (data?.item) {
      upsertTerminalRecord(data.item);
      return data.item;
    }
    return null;
  };

  const handleApprove = async () => {
    if (!terminalId) return;
    setProcessing(true);
    try {
      await apiFetch(`/api/terminal/${terminalId}/approve`, {
        method: "POST",
        token,
      });
      await refreshRecord(terminalId);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!terminalId) return;
    setProcessing(true);
    try {
      await apiFetch(`/api/terminal/${terminalId}/deny`, {
        method: "POST",
        token,
      });
      await refreshRecord(terminalId);
    } finally {
      setProcessing(false);
    }
  };

  const handleRerun = async () => {
    if (!terminalId) return;
    setProcessing(true);
    try {
      const data = await apiFetch(`/api/terminal/${terminalId}/rerun`, {
        method: "POST",
        token,
      });
      if (data?.id) {
        await refreshRecord(data.id);
        if (typeof onReplaceTerminalId === "function") {
          onReplaceTerminalId(data.id);
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mb-2 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-white/35">
            Terminal
          </p>
          <p className="mt-1 break-words text-sm font-medium text-white/90">
            {detail?.command || fallbackBody || "Terminal command"}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${badgeClass}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-white/45">
        <div>Requested: {formatDateTime(detail?.requestedAt)}</div>
        {detail?.executedAt ? (
          <div>Executed: {formatDateTime(detail.executedAt)}</div>
        ) : null}
      </div>

      {detail?.result?.stdout || detail?.result?.stderr ? (
        <div className="mt-3 space-y-2">
          {detail?.result?.stdout ? (
            <pre className="max-h-28 overflow-auto rounded-xl bg-black/35 p-3 text-xs text-emerald-100/90">
              {detail.result.stdout}
            </pre>
          ) : null}
          {detail?.result?.stderr ? (
            <pre className="max-h-28 overflow-auto rounded-xl bg-black/35 p-3 text-xs text-red-100/90">
              {detail.result.stderr}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-full bg-yellow-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          onClick={handleRerun}
          disabled={processing || loading}
        >
          Rerun
        </button>
        {status === "pending" ? (
          <>
            <button
              type="button"
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={handleApprove}
              disabled={processing || loading}
            >
              Approve
            </button>
            <button
              type="button"
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={handleDeny}
              disabled={processing || loading}
            >
              Deny
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
