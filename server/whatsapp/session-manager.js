const EventEmitter = require("events");
const { MockAdapter } = require("./adapters/mock-adapter");
const { WwebjsAdapter } = require("./adapters/wwebjs-adapter");
const chatService = require("../services/chat-service");
const sessionService = require("../services/session-service");

function formatTransportError(transportType, error) {
  const message = String(error?.message || error || "Unknown error");
  if (transportType === "wwebjs" && message.includes("Cannot find module")) {
    return "whatsapp-web.js is not installed. Run `npm install whatsapp-web.js` in the OpenWA package, then try Connect again.";
  }

  return `${transportType} failed: ${message}`;
}

function safeAsyncListener(handler, label) {
  return (...args) => {
    Promise.resolve(handler(...args)).catch((error) => {
      console.error(`Session manager listener failed (${label}).`, error);
    });
  };
}

class SessionManager extends EventEmitter {
  constructor({ config }) {
    super();
    this.config = config;
    this.adapters = new Map();
    this.retryTimers = new Map();
    this.manualDisconnects = new Set();
    this.qrPersistTimers = new Map();
    this.queuedQrStates = new Map();
    this.resetInProgress = false;
  }

  async hydrate(sessions) {
    const reconnectable = sessions.filter(
      (session) =>
        session.status === "ready" || session.status === "connecting",
    );
    for (const session of reconnectable) {
      await this.connectSession(session.userId, session.id);
    }
  }

  async connectSession(userId, sessionId, options = {}) {
    if (this.resetInProgress) {
      throw new Error(
        "Session connection disabled while reset is in progress.",
      );
    }

    const { force = false } = options;
    this.manualDisconnects.delete(sessionId);
    this.clearRetry(sessionId);
    this.clearQueuedQrPersist(sessionId);

    const existing = this.adapters.get(sessionId);
    if (existing) {
      if (force) {
        try {
          await existing.adapter.disconnect();
        } catch (error) {
          // Ignore adapter teardown errors while forcing a fresh connect.
        }
        existing.adapter.removeAllListeners();
        this.adapters.delete(sessionId);
      } else {
        return existing.adapter;
      }
    }

    const session = await sessionService.getSessionById(userId, sessionId);
    if (!session) {
      console.warn(
        `[SessionManager] Attempted to connect non-existent session: ${sessionId}`,
      );
      throw new Error("Session not found.");
    }

    await sessionService.touchSessionState(session.id, {
      status: "connecting",
      qrCode: null,
      lastError: null,
      transportType: this.config.useWwebjs ? "wwebjs" : "mock",
    });

    const candidates = [];

    if (this.config.useWwebjs) {
      candidates.push({
        adapter: new WwebjsAdapter({ session }),
        transportType: "wwebjs",
      });
    }

    if (this.config.allowMockAdapter) {
      candidates.push({
        adapter: new MockAdapter({ session }),
        transportType: "mock",
      });
    }

    if (candidates.length === 0) {
      throw new Error(
        "No WhatsApp transport is enabled. Enable whatsapp-web.js or set OPENWA_ALLOW_MOCK=true for mock mode.",
      );
    }

    let previousError = null;

    for (const candidate of candidates) {
      try {
        this.attachAdapter({
          session,
          adapter: candidate.adapter,
          transportType: candidate.transportType,
        });

        await sessionService.touchSessionState(session.id, {
          status: "connecting",
          transportType: candidate.transportType,
          lastError: previousError,
        });

        await candidate.adapter.connect();
        return candidate.adapter;
      } catch (error) {
        // DEBUG: Print full error stack for diagnosis
        console.error(
          "[OpenWA] Adapter connect error:",
          error && error.stack ? error.stack : error,
        );
        this.adapters.delete(session.id);
        candidate.adapter.removeAllListeners();
        try {
          await candidate.adapter.disconnect();
        } catch (disconnectError) {
          // Ignore cleanup errors after a failed connect attempt.
        }
        previousError = formatTransportError(candidate.transportType, error);
      }
    }

    await sessionService.touchSessionState(session.id, {
      status: "error",
      qrCode: null,
      lastError: previousError,
    });

    this.emit("session-status", {
      id: session.id,
      userId: session.userId,
      sessionId: session.id,
      status: "error",
      lastError: previousError,
      qrCode: null,
    });

    throw new Error(previousError || "Unable to connect session.");
  }

  attachAdapter({ session, adapter, transportType }) {
    adapter.on(
      "qr",
      safeAsyncListener(async (payload) => {
        this.queueQrStatePersist(session.id, {
          status: "connecting",
          qrCode: payload.qrCode,
          transportType: payload.transportType || transportType,
        });

        this.emit("session-status", {
          id: session.id,
          userId: session.userId,
          sessionId: session.id,
          status: "connecting",
          qrCode: payload.qrCode,
          transportType: payload.transportType || transportType,
        });
      }, "qr"),
    );

    adapter.on(
      "status",
      safeAsyncListener(async (payload) => {
        const nextQrCode =
          payload.status === "ready" ||
          payload.status === "disconnected" ||
          payload.status === "error"
            ? null
            : undefined;

        if (payload.status === "ready") {
          this.clearRetry(session.id);
        }

        if (
          payload.status === "ready" ||
          payload.status === "disconnected" ||
          payload.status === "error"
        ) {
          this.clearQueuedQrPersist(session.id);
        }

        await sessionService.touchSessionState(session.id, {
          status: payload.status,
          transportType: payload.transportType || transportType,
          lastError: payload.lastError || null,
          qrCode: nextQrCode,
          phoneNumber: payload.phoneNumber || undefined,
        });

        this.emit("session-status", {
          id: session.id,
          userId: session.userId,
          sessionId: session.id,
          status: payload.status,
          transportType: payload.transportType || transportType,
          lastError: payload.lastError || null,
          qrCode: nextQrCode,
          phoneNumber: payload.phoneNumber || undefined,
        });

        if (
          payload.status === "ready" &&
          typeof adapter.getSyncSnapshot === "function"
        ) {
          try {
            // Emit a starting event so UI can show a specific "syncing" state
            this.emit("workspace-sync-started", {
              id: session.id,
              userId: session.userId,
              sessionId: session.id,
              status: "syncing",
            });

            const snapshot = await adapter.getSyncSnapshot();
            await chatService.syncWhatsappSnapshot({
              userId: session.userId,
              sessionId: session.id,
              contacts: snapshot.contacts,
              chats: snapshot.chats,
            });

            this.emit("workspace-sync", {
              id: session.id,
              userId: session.userId,
              sessionId: session.id,
              status: "completed",
            });
          } catch (error) {
            const lastError = `WhatsApp sync failed: ${error.message}`;
            console.error(
              `[SessionManager] Sync error for session ${session.id}:`,
              error,
            );

            await sessionService.touchSessionState(session.id, {
              lastError,
            });

            this.emit("workspace-sync", {
              id: session.id,
              userId: session.userId,
              sessionId: session.id,
              status: "failed",
              error: lastError,
            });

            this.emit("session-status", {
              id: session.id,
              userId: session.userId,
              sessionId: session.id,
              status: payload.status,
              transportType: payload.transportType || transportType,
              lastError,
              qrCode: nextQrCode,
            });
          }
        }

        if (payload.status === "disconnected" || payload.status === "error") {
          this.adapters.delete(session.id);
          if (!this.manualDisconnects.has(session.id)) {
            this.scheduleReconnect(session.userId, session.id, payload.status);
          }
        }
      }, "status"),
    );

    adapter.on("message", (payload) => {
      this.emit("incoming-message", {
        userId: session.userId,
        sessionId: session.id,
        ...payload,
      });
    });

    this.adapters.set(session.id, { adapter });
  }

  async disconnectSession(userId, sessionId) {
    this.manualDisconnects.add(sessionId);
    this.clearRetry(sessionId);
    this.clearQueuedQrPersist(sessionId);
    const session = await sessionService.getSessionById(userId, sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    const record = this.adapters.get(sessionId);
    if (record) {
      await record.adapter.disconnect();
      this.adapters.delete(sessionId);
    }

    await sessionService.touchSessionState(sessionId, {
      status: "disconnected",
      qrCode: null,
      lastError: null,
    });
  }

  async sendMessage(sessionId, payload) {
    const record = this.adapters.get(sessionId);
    if (!record) {
      throw new Error("Session is not connected.");
    }

    return record.adapter.sendMessage(payload);
  }

  scheduleReconnect(userId, sessionId, reason) {
    if (this.resetInProgress || this.retryTimers.has(sessionId)) {
      return;
    }

    const timer = setTimeout(async () => {
      this.retryTimers.delete(sessionId);

      if (this.resetInProgress || this.manualDisconnects.has(sessionId)) {
        return;
      }

      try {
        await this.connectSession(userId, sessionId);
      } catch (error) {
        await sessionService.touchSessionState(sessionId, {
          status: "error",
          lastError: `Reconnect failed after ${reason}: ${error.message}`,
        });

        this.emit("session-status", {
          id: sessionId,
          userId,
          sessionId,
          status: "error",
          lastError: `Reconnect failed after ${reason}: ${error.message}`,
          qrCode: null,
        });

        this.scheduleReconnect(userId, sessionId, reason);
      }
    }, 5000);

    this.retryTimers.set(sessionId, timer);
  }

  clearRetry(sessionId) {
    const timer = this.retryTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(sessionId);
    }
  }

  queueQrStatePersist(sessionId, data) {
    this.queuedQrStates.set(sessionId, {
      ...(this.queuedQrStates.get(sessionId) || {}),
      ...data,
    });

    if (this.qrPersistTimers.has(sessionId)) {
      return;
    }

    const timer = setTimeout(() => {
      const pendingState = this.queuedQrStates.get(sessionId);
      this.qrPersistTimers.delete(sessionId);
      this.queuedQrStates.delete(sessionId);

      if (!pendingState) {
        return;
      }

      sessionService
        .touchSessionState(sessionId, pendingState)
        .catch((error) => {
          console.error(
            `Failed to persist queued QR state for session ${sessionId}.`,
            error,
          );
        });
    }, 400);

    this.qrPersistTimers.set(sessionId, timer);
  }

  clearQueuedQrPersist(sessionId) {
    const timer = this.qrPersistTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.qrPersistTimers.delete(sessionId);
    }

    this.queuedQrStates.delete(sessionId);
  }

  async stopAll() {
    this.resetInProgress = true;
    for (const [sessionId, existing] of Array.from(this.adapters.entries())) {
      try {
        this.manualDisconnects.add(sessionId);

        if (
          existing?.adapter &&
          typeof existing.adapter.disconnect === "function"
        ) {
          await existing.adapter.disconnect();
        }
      } catch (error) {
        console.warn(
          `[SessionManager] Failed to disconnect session ${sessionId}:`,
          error.message,
        );
      }
      try {
        existing.adapter?.removeAllListeners();
      } catch (error) {
        // ignore
      }
      this.clearRetry(sessionId);
      this.clearQueuedQrPersist(sessionId);
      this.adapters.delete(sessionId);
    }
    this.resetInProgress = false;
  }
}

module.exports = { SessionManager };
