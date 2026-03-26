const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { createServer } = require("http");
const next = require("next");
const openModule = require("open");
const { Server } = require("socket.io");
const { getConfig } = require("./config");
const { initializeDatabase } = require("./database/init");
const { createApp } = require("./express/create-app");
const chatService = require("./services/chat-service");
const sessionService = require("./services/session-service");
const { registerSocketHandlers, userRoom } = require("./socket/register");
const { ensureRuntimeDirs, webDir } = require("./utils/paths");
const { SessionManager } = require("./whatsapp/session-manager");
const openBrowser = openModule.default || openModule;

function ensureWebBuild(config) {
  if (config.dev) {
    return;
  }

  const buildIdPath = path.join(webDir, ".next", "BUILD_ID");
  if (fs.existsSync(buildIdPath)) {
    return;
  }

  console.log("Next.js production build not found. Building dashboard automatically...");
  const result = spawnSync("npm", ["run", "build:web"], {
    cwd: path.dirname(webDir),
    stdio: "inherit",
    env: process.env,
    shell: true
  });

  if (result.status !== 0) {
    throw new Error("Automatic Next.js build failed.");
  }
}

async function startOpenWA({ dev = false } = {}) {
  const config = getConfig({ dev });
  process.env.NEXT_PUBLIC_API_URL = config.backendUrl;
  process.env.NEXT_PUBLIC_SOCKET_URL = config.backendUrl;

  ensureRuntimeDirs();
  await initializeDatabase();
  ensureWebBuild(config);

  const nextApp = next({
    dev: config.dev,
    dir: webDir
  });

  await nextApp.prepare();
  const nextHandler = nextApp.getRequestHandler();

  const sessionManager = new SessionManager({ config });
  const app = createApp({
    config,
    sessionManager
  });

  const backendServer = createServer(app);
  const frontendServer = createServer((req, res) => nextHandler(req, res));
  const io = new Server(backendServer, {
    cors: {
      origin: config.frontendUrl,
      credentials: true
    }
  });

  sessionManager.on("session-status", (payload) => {
    io.to(userRoom(payload.userId)).emit("session_status_update", payload);
  });

  sessionManager.on("incoming-message", async (payload) => {
    try {
      const result = await chatService.storeIncomingMessage(payload);
      io.to(userRoom(payload.userId)).emit("new_message", result.message);
      io.to(userRoom(payload.userId)).emit("contact_list_update", result.chat);
    } catch (error) {
      console.error("Failed to persist incoming WhatsApp message.", error);
    }
  });

  sessionManager.on("workspace-sync", (payload) => {
    io.to(userRoom(payload.userId)).emit("workspace_synced", payload);
  });

  registerSocketHandlers({
    io,
    config,
    sessionManager
  });

  await new Promise((resolve) => {
    backendServer.listen(config.backendPort, config.host, resolve);
  });

  await new Promise((resolve) => {
    frontendServer.listen(config.frontendPort, config.host, resolve);
  });

  const reconnectableSessions = await sessionService.listReconnectableSessions();
  await sessionManager.hydrate(reconnectableSessions);

  console.log("OpenWA is running 🚀\n");
  console.log(`Dashboard: ${config.frontendUrl}`);
  console.log(`Backend API: ${config.backendUrl}`);
  console.log("WhatsApp Sessions: ready");
  console.log("Socket: connected");
  console.log("Database: connected");

  if (config.autoOpenBrowser) {
    try {
      await openBrowser(config.frontendUrl);
    } catch (error) {
      console.warn(`Browser auto-open failed: ${error.message}`);
    }
  }

  return { app, backendServer, frontendServer, io };
}

module.exports = {
  startOpenWA
};
