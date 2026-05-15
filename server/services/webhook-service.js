const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { prisma } = require("../database/client");
const { rootDir } = require("../utils/paths");

const storePath = path.join(rootDir, "storage", "webhooks.json");
const deliveryTimeoutMs = 10000;
const retryDelaysMs = [0, 1000, 3000];

function getEncryptionKey() {
  const secret =
    process.env.OPENWA_WEBHOOK_SECRET_KEY ||
    process.env.OPENWA_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "openwa-local-webhook-secret";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptSecret(value) {
  const text = String(value || "");
  if (!text) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (!text.startsWith("v1:")) return text;

  const [, ivRaw, tagRaw, encryptedRaw] = text.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivRaw, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function readStore() {
  try {
    if (!fs.existsSync(storePath)) return {};
    return JSON.parse(fs.readFileSync(storePath, "utf8") || "{}");
  } catch (err) {
    console.error("Failed to read webhook store:", err);
    return {};
  }
}

function writeStore(data) {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write webhook store:", err);
  }
}

function normalizeConfigForRead(config) {
  if (!config) return null;
  return {
    url: config.url || "",
    apiKey: config.apiKeyEncrypted
      ? decryptSecret(config.apiKeyEncrypted)
      : config.apiKey || "",
  };
}

function normalizeConfigForWrite(config = {}) {
  const apiKey = String(config.apiKey || "");
  return {
    url: String(config.url || "").trim(),
    apiKeyEncrypted: encryptSecret(apiKey),
  };
}

async function deliver(cfg, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deliveryTimeoutMs);

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openwa-webhook-key": cfg.apiKey || "",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      const error = new Error(`Webhook returned HTTP ${res.status}`);
      error.responseStatus = res.status;
      error.responseBody = body.slice(0, 2000);
      throw error;
    }
    return {
      responseStatus: res.status,
      responseBody: body.slice(0, 2000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function payloadIds(payload = {}) {
  return {
    chatId: payload.chat?.id || payload.message?.chatId || null,
    messageId: payload.message?.id || null,
  };
}

async function createDeliveryLog(userId, cfg, payload) {
  const ids = payloadIds(payload);
  return prisma.webhookDeliveryLog.create({
    data: {
      userId,
      chatId: ids.chatId,
      messageId: ids.messageId,
      url: cfg.url,
      payload,
      status: "pending",
    },
  });
}

async function runDelivery(userId, logId, cfg, payload) {
  let lastError = null;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    const delayMs = retryDelaysMs[attempt];
    if (delayMs > 0) await sleep(delayMs);

    try {
      const result = await deliver(cfg, payload);
      const log = await prisma.webhookDeliveryLog.update({
        where: { id: logId },
        data: {
          status: "delivered",
          attempts: attempt + 1,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody || null,
          error: null,
          deliveredAt: new Date(),
        },
      });
      return { ok: true, attempts: attempt + 1, log };
    } catch (err) {
      lastError = err;
      await prisma.webhookDeliveryLog.updateMany({
        where: { id: logId, userId },
        data: {
          attempts: attempt + 1,
          responseStatus: err.responseStatus || null,
          responseBody: err.responseBody || null,
          error: err.message || "Webhook delivery failed",
        },
      });
    }
  }

  const log = await prisma.webhookDeliveryLog.update({
    where: { id: logId },
    data: {
      status: "failed",
      error: lastError?.message || "Webhook delivery failed",
    },
  });

  console.error("Failed to deliver webhook for user", userId, lastError);
  return { ok: false, error: log.error, log };
}

function sanitizeDeliveryLog(log) {
  if (!log) return null;
  return {
    id: log.id,
    userId: log.userId,
    chatId: log.chatId,
    messageId: log.messageId,
    url: log.url,
    status: log.status,
    attempts: log.attempts,
    responseStatus: log.responseStatus,
    responseBody: log.responseBody,
    error: log.error,
    deliveredAt: log.deliveredAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

module.exports = {
  getWebhook: (userId) => {
    const store = readStore();
    return normalizeConfigForRead(store[userId]);
  },

  setWebhook: (userId, cfg) => {
    const store = readStore();
    store[userId] = normalizeConfigForWrite(cfg);
    writeStore(store);
    return normalizeConfigForRead(store[userId]);
  },

  deleteWebhook: (userId) => {
    const store = readStore();
    delete store[userId];
    writeStore(store);
  },

  notifyWebhook: async (userId, payload) => {
    const cfg = module.exports.getWebhook(userId);
    if (!cfg || !cfg.url) return null;

    const log = await createDeliveryLog(userId, cfg, payload);
    return runDelivery(userId, log.id, cfg, payload);
  },

  listDeliveries: async (userId, { status, chatId, limit = 50 } = {}) => {
    const take = Math.max(1, Math.min(Number(limit) || 50, 200));
    const logs = await prisma.webhookDeliveryLog.findMany({
      where: {
        userId,
        ...(status ? { status: String(status) } : {}),
        ...(chatId ? { chatId: String(chatId) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return logs.map(sanitizeDeliveryLog);
  },

  retryDelivery: async (userId, deliveryId) => {
    const log = await prisma.webhookDeliveryLog.findFirst({
      where: {
        id: deliveryId,
        userId,
      },
    });
    if (!log) throw new Error("Webhook delivery log not found.");

    const cfg = module.exports.getWebhook(userId);
    if (!cfg || !cfg.url) throw new Error("Webhook is not configured.");

    await prisma.webhookDeliveryLog.update({
      where: { id: log.id },
      data: {
        status: "pending",
        error: null,
        responseStatus: null,
        responseBody: null,
        deliveredAt: null,
      },
    });

    return runDelivery(userId, log.id, cfg, log.payload);
  },
};
