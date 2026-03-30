const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const {
  authMiddleware,
  dashboardAuthMiddleware,
  isSqliteTimeoutError,
  loginUser,
  registerUser,
} = require("../services/auth-service");
const apiKeyService = require("../services/api-key-service");
const chatService = require("../services/chat-service");
const sessionService = require("../services/session-service");
const {
  createAgentReadme,
  createOpenApiDocument,
  createSwaggerHtml,
  packageName,
  packageVersion,
} = require("./openapi");
const { mediaDir } = require("../utils/paths");

function inferMessageType(file) {
  if (!file?.mimetype) {
    return "document";
  }

  if (file.mimetype === "image/webp") {
    return "sticker";
  }

  if (file.mimetype.startsWith("image/")) {
    return "image";
  }
  if (file.mimetype.startsWith("video/")) {
    return "video";
  }
  if (file.mimetype.startsWith("audio/")) {
    return "audio";
  }

  return "document";
}

function createUploader() {
  const storage = multer.diskStorage({
    destination: mediaDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({ storage });
}

function withAsync(handler, statusCode = 500) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error?.code === "P1008" ? 503 : statusCode).json({
        error:
          error?.code === "P1008"
            ? "Database is busy. Please try again."
            : error.message,
      });
    }
  };
}

function createApp({ config, sessionManager }) {
  const app = express();
  // CORS middleware harus di paling atas
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", config.frontendUrl);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-API-Key, X-OpenWA-API-Key",
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });

  const upload = createUploader();
  const requireAuth = authMiddleware(config);
  const requireDashboardAuth = dashboardAuthMiddleware(config);
  const openApiDocument = createOpenApiDocument(config);

  // Endpoint DELETE session harus di sini agar app dan requireAuth sudah terdefinisi
  app.delete("/api/sessions/:sessionId", requireAuth, async (req, res) => {
    try {
      await sessionManager.disconnectSession(req.user.id, req.params.sessionId);
      await sessionService.deleteSession(req.user.id, req.params.sessionId);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/media", express.static(mediaDir));

  app.get("/docs", (req, res) => {
    res.type("html").send(createSwaggerHtml());
  });

  app.get("/docs/json", (req, res) => {
    res.json(openApiDocument);
  });

  app.get("/docs/readme", (req, res) => {
    res.type("text/markdown").send(createAgentReadme(config));
  });

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: packageName,
      version: packageVersion,
    });
  });

  app.get("/version", (req, res) => {
    res.json({
      name: packageName,
      version: packageVersion,
    });
  });

  app.get("/api/health", async (req, res) => {
    res.json({
      ok: true,
      service: packageName,
      version: packageVersion,
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = await registerUser({
        ...req.body,
        config,
      });

      await chatService.ensureWelcomeWorkspace(result.user.id);

      res.status(201).json(result);
    } catch (error) {
      res.status(isSqliteTimeoutError(error) ? 503 : 400).json({
        error: isSqliteTimeoutError(error)
          ? "Database is busy. Please try again."
          : error.message,
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = await loginUser({
        ...req.body,
        config,
      });

      await chatService.ensureWelcomeWorkspace(result.user.id);

      res.json(result);
    } catch (error) {
      res.status(isSqliteTimeoutError(error) ? 503 : 400).json({
        error: isSqliteTimeoutError(error)
          ? "Database is busy. Please try again."
          : error.message,
      });
    }
  });

  app.get(
    "/api/auth/me",
    requireAuth,
    withAsync(async (req, res) => {
      res.json({ user: req.user });
    }),
  );

  app.get(
    "/api/api-keys",
    requireDashboardAuth,
    withAsync(async (req, res) => {
      const apiKeys = await apiKeyService.listApiKeys(req.user.id);
      res.json({ apiKeys });
    }),
  );

  app.post("/api/api-keys", requireDashboardAuth, async (req, res) => {
    try {
      const result = await apiKeyService.createApiKey(req.user.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete(
    "/api/api-keys/:apiKeyId",
    requireDashboardAuth,
    async (req, res) => {
      try {
        const result = await apiKeyService.revokeApiKey(
          req.user.id,
          req.params.apiKeyId,
        );
        res.json(result);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    },
  );

  app.get("/api/bootstrap", requireAuth, async (req, res) => {
    try {
      await chatService.ensureWelcomeWorkspace(req.user.id);
      const sessions = await sessionService.listUserSessions(req.user.id);
      const chats = await chatService.listChats(req.user.id);
      const activeChatId = chats[0]?.id || null;
      const messageResult = activeChatId
        ? await chatService.listMessages(req.user.id, activeChatId)
        : { messages: [], hasMore: false, nextBefore: null };

      res.json({
        user: req.user,
        sessions,
        chats,
        activeChatId,
        messages: messageResult.messages,
        hasMoreMessages: messageResult.hasMore,
        nextBefore: messageResult.nextBefore,
      });
    } catch (error) {
      res.status(error?.code === "P1008" ? 503 : 500).json({
        error:
          error?.code === "P1008"
            ? "Database is busy. Please try again."
            : error.message,
      });
    }
  });

  app.get(
    "/api/sessions",
    requireAuth,
    withAsync(async (req, res) => {
      const sessions = await sessionService.listUserSessions(req.user.id);
      res.json({ sessions });
    }),
  );

  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const session = await sessionService.createUserSession(
        req.user.id,
        req.body,
      );
      await chatService.createSessionCompanionChat(req.user.id, session);
      res.status(201).json({ session });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post(
    "/api/sessions/:sessionId/connect",
    requireAuth,
    async (req, res) => {
      try {
        await sessionManager.connectSession(req.user.id, req.params.sessionId, {
          force: true,
        });
        const session = await sessionService.getSessionById(
          req.user.id,
          req.params.sessionId,
        );
        res.json({ session });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    },
  );

  app.post(
    "/api/sessions/:sessionId/disconnect",
    requireAuth,
    async (req, res) => {
      try {
        await sessionManager.disconnectSession(
          req.user.id,
          req.params.sessionId,
        );
        const session = await sessionService.getSessionById(
          req.user.id,
          req.params.sessionId,
        );
        res.json({ session });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    },
  );

  app.get(
    "/api/chats",
    requireAuth,
    withAsync(async (req, res) => {
      const chats = await chatService.listChats(
        req.user.id,
        req.query.sessionId || undefined,
        req.query.q || "",
      );
      res.json({ chats });
    }),
  );

  app.get(
    "/api/contacts",
    requireAuth,
    withAsync(async (req, res) => {
      const contacts = await chatService.listContacts(
        req.user.id,
        req.query.sessionId || undefined,
        req.query.q || "",
      );
      res.json({ contacts });
    }),
  );

  app.post("/api/contacts/:contactId/open", requireAuth, async (req, res) => {
    try {
      const chat = await chatService.openChatForContact(
        req.user.id,
        req.params.contactId,
      );
      res.json({ chat });
    } catch (error) {
      res.status(error?.code === "P1008" ? 503 : 400).json({
        error:
          error?.code === "P1008"
            ? "Database is busy. Please try again."
            : error.message,
      });
    }
  });

  app.get("/api/chats/:chatId/messages", requireAuth, async (req, res) => {
    try {
      const result = await chatService.listMessages(
        req.user.id,
        req.params.chatId,
        {
          take: req.query.take,
          before: req.query.before,
          search: req.query.search,
        },
      );
      res.json(result);
    } catch (error) {
      res.status(error?.code === "P1008" ? 503 : 404).json({
        error:
          error?.code === "P1008"
            ? "Database is busy. Please try again."
            : error.message,
      });
    }
  });

  app.post(
    "/api/chats/:chatId/messages/send",
    requireAuth,
    async (req, res) => {
      try {
        const result = await chatService.createOutgoingMessage({
          userId: req.user.id,
          chatId: req.params.chatId,
          body: req.body.body,
          type: req.body.type || "text",
          mediaFileId: req.body.mediaFileId || null,
          replyToId: req.body.replyToId || null,
        });

        if (result.message.sessionId) {
          await sessionManager.sendMessage(result.message.sessionId, {
            recipient: result.message.receiver,
            body: result.message.body,
            mediaFileId: result.message.mediaFileId,
            mediaPath: result.message.mediaFile?.relativePath || null,
          });

          await chatService.addMessageStatus(result.message.id, "delivered");
          result.message.statuses = [
            ...(result.message.statuses || []),
            { status: "delivered", createdAt: new Date().toISOString() },
          ];
        }

        res.json(result);
      } catch (error) {
        res.status(error?.code === "P1008" ? 503 : 400).json({
          error:
            error?.code === "P1008"
              ? "Database is busy. Please try again."
              : error.message,
        });
      }
    },
  );

  app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
    try {
      const result = await chatService.deleteMessage(
        req.user.id,
        req.params.messageId,
      );
      res.json(result);
    } catch (error) {
      res.status(error?.code === "P1008" ? 503 : 400).json({
        error:
          error?.code === "P1008"
            ? "Database is busy. Please try again."
            : error.message,
      });
    }
  });

  app.post(
    "/api/messages/:messageId/forward",
    requireAuth,
    async (req, res) => {
      try {
        const result = await chatService.forwardMessage(
          req.user.id,
          req.params.messageId,
          req.body.targetChatId,
        );
        res.json(result);
      } catch (error) {
        res.status(error?.code === "P1008" ? 503 : 400).json({
          error:
            error?.code === "P1008"
              ? "Database is busy. Please try again."
              : error.message,
        });
      }
    },
  );

  app.post(
    "/api/media",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "File is required." });
        }

        const mediaFile = await chatService.createMediaFile(
          req.user.id,
          req.file,
        );
        return res.status(201).json({
          mediaFile,
          type: inferMessageType(req.file),
        });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    },
  );

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
  });

  return app;
}

module.exports = { createApp };
