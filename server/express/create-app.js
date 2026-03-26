const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { authMiddleware, loginUser, registerUser } = require("../services/auth-service");
const chatService = require("../services/chat-service");
const sessionService = require("../services/session-service");
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
    }
  });

  return multer({ storage });
}

function createApp({ config, sessionManager }) {
  const app = express();
  const upload = createUploader();
  const requireAuth = authMiddleware(config);

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", config.frontendUrl);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/media", express.static(mediaDir));

  app.get("/api/health", async (req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = await registerUser({
        ...req.body,
        config
      });

      await chatService.ensureWelcomeWorkspace(result.user.id);

      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = await loginUser({
        ...req.body,
        config
      });

      await chatService.ensureWelcomeWorkspace(result.user.id);

      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/bootstrap", requireAuth, async (req, res) => {
    await chatService.ensureWelcomeWorkspace(req.user.id);
    const sessions = await sessionService.listUserSessions(req.user.id);
    const chats = await chatService.listChats(req.user.id);
    const activeChatId = chats[0]?.id || null;
    const messageResult = activeChatId ? await chatService.listMessages(req.user.id, activeChatId) : { messages: [], hasMore: false, nextBefore: null };

    res.json({
      user: req.user,
      sessions,
      chats,
      activeChatId,
      messages: messageResult.messages,
      hasMoreMessages: messageResult.hasMore,
      nextBefore: messageResult.nextBefore
    });
  });

  app.get("/api/sessions", requireAuth, async (req, res) => {
    const sessions = await sessionService.listUserSessions(req.user.id);
    res.json({ sessions });
  });

  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const session = await sessionService.createUserSession(req.user.id, req.body);
      await chatService.createSessionCompanionChat(req.user.id, session);
      res.status(201).json({ session });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:sessionId/connect", requireAuth, async (req, res) => {
    try {
      await sessionManager.connectSession(req.user.id, req.params.sessionId, { force: true });
      const session = await sessionService.getSessionById(req.user.id, req.params.sessionId);
      res.json({ session });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:sessionId/disconnect", requireAuth, async (req, res) => {
    try {
      await sessionManager.disconnectSession(req.user.id, req.params.sessionId);
      const session = await sessionService.getSessionById(req.user.id, req.params.sessionId);
      res.json({ session });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/chats", requireAuth, async (req, res) => {
    const chats = await chatService.listChats(req.user.id, req.query.sessionId || undefined, req.query.q || "");
    res.json({ chats });
  });

  app.get("/api/contacts", requireAuth, async (req, res) => {
    const contacts = await chatService.listContacts(req.user.id, req.query.sessionId || undefined, req.query.q || "");
    res.json({ contacts });
  });

  app.post("/api/contacts/:contactId/open", requireAuth, async (req, res) => {
    try {
      const chat = await chatService.openChatForContact(req.user.id, req.params.contactId);
      res.json({ chat });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/chats/:chatId/messages", requireAuth, async (req, res) => {
    try {
      const result = await chatService.listMessages(req.user.id, req.params.chatId, {
        take: req.query.take,
        before: req.query.before,
        search: req.query.search
      });
      res.json(result);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
    try {
      const result = await chatService.deleteMessage(req.user.id, req.params.messageId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/messages/:messageId/forward", requireAuth, async (req, res) => {
    try {
      const result = await chatService.forwardMessage(req.user.id, req.params.messageId, req.body.targetChatId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/media", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File is required." });
      }

      const mediaFile = await chatService.createMediaFile(req.user.id, req.file);
      return res.status(201).json({
        mediaFile,
        type: inferMessageType(req.file)
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
  });

  return app;
}

module.exports = { createApp };
