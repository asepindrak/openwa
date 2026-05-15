const { prisma } = require("../database/client");
const chatService = require("./chat-service");
const TelegramService = require("./telegram-service");

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WORKER_INTERVAL_MS = 5000;
const BACKOFF_MS = [10000, 30000, 60000, 180000, 300000];
const activeJobs = new Set();

let workerTimer = null;
let workerContext = null;

function userRoom(userId) {
  return `user:${userId}`;
}

function serializeJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    userId: job.userId,
    messageId: job.messageId,
    transport: job.transport,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    nextAttemptAt: job.nextAttemptAt,
    lastError: job.lastError,
    deliveredAt: job.deliveredAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function emitJobUpdate(io, job) {
  if (!io || !job?.userId) return;
  io.to(userRoom(job.userId)).emit("outbound_delivery_update", {
    delivery: serializeJob(job),
  });
}

function resolveTransport(message) {
  if (message?.sessionId) return "whatsapp";
  if (String(message?.receiver || "").startsWith("tg:")) return "telegram";
  return "unknown";
}

function getBackoffMs(attempts) {
  const index = Math.max(0, Math.min(attempts - 1, BACKOFF_MS.length - 1));
  return BACKOFF_MS[index];
}

async function loadMessageForUser(userId, messageId) {
  return prisma.message.findFirst({
    where: {
      id: messageId,
      direction: "outbound",
      chat: { userId },
    },
    include: {
      mediaFile: true,
      statuses: true,
      chat: {
        include: {
          contact: true,
        },
      },
    },
  });
}

async function markDelivered(messageId) {
  const existing = await prisma.messageStatus.findFirst({
    where: {
      messageId,
      status: "delivered",
    },
  });
  if (existing) return existing;
  return chatService.addMessageStatus(messageId, "delivered");
}

async function deliverMessage({ message, sessionManager }) {
  const transport = resolveTransport(message);

  if (transport === "whatsapp") {
    if (!sessionManager?.sendMessage) {
      throw new Error("WhatsApp session manager is not available.");
    }
    await sessionManager.sendMessage(message.sessionId, {
      recipient: message.receiver,
      body: message.body,
      mediaFileId: message.mediaFileId,
      mediaPath: message.mediaFile?.relativePath || null,
    });
    return true;
  }

  if (transport === "telegram") {
    const telegramId = TelegramService.extractTelegramId(message.receiver);
    if (!telegramId) {
      throw new Error("Invalid Telegram receiver.");
    }

    const sent = message.mediaFile
      ? await TelegramService.sendMedia(
          message.chat.userId,
          telegramId,
          message.mediaFile,
          message.body || "",
        )
      : await TelegramService.sendMessage(
          message.chat.userId,
          telegramId,
          message.body || "",
        );

    if (!sent) {
      throw new Error("Telegram bot is not running.");
    }
    return true;
  }

  throw new Error("No outbound transport is available for this message.");
}

async function processJob(jobOrId, { sessionManager, io } = {}) {
  const jobId = typeof jobOrId === "string" ? jobOrId : jobOrId?.id;
  if (!jobId || activeJobs.has(jobId)) return null;

  activeJobs.add(jobId);
  try {
    const job = await prisma.outboundDeliveryJob.findUnique({
      where: { id: jobId },
      include: {
        message: {
          include: {
            mediaFile: true,
            statuses: true,
            chat: true,
          },
        },
      },
    });

    if (!job || job.status === "delivered" || job.status === "failed") {
      return job;
    }

    const claimed = await prisma.outboundDeliveryJob.updateMany({
      where: {
        id: job.id,
        status: { in: ["queued", "sending"] },
      },
      data: { status: "sending" },
    });
    if (!claimed.count) return job;

    const sendingJob = await prisma.outboundDeliveryJob.findUnique({
      where: { id: job.id },
    });
    emitJobUpdate(io, sendingJob);

    try {
      await deliverMessage({ message: job.message, sessionManager });
      await markDelivered(job.messageId);
      const deliveredJob = await prisma.outboundDeliveryJob.update({
        where: { id: job.id },
        data: {
          status: "delivered",
          attempts: { increment: 1 },
          lastError: null,
          deliveredAt: new Date(),
        },
      });
      if (io) {
        io.to(userRoom(job.userId)).emit("message_status_update", {
          messageId: job.messageId,
          status: "delivered",
        });
      }
      emitJobUpdate(io, deliveredJob);
      return deliveredJob;
    } catch (error) {
      const nextAttempts = job.attempts + 1;
      const finalFailure = nextAttempts >= job.maxAttempts;
      const failedJob = await prisma.outboundDeliveryJob.update({
        where: { id: job.id },
        data: {
          status: finalFailure ? "failed" : "queued",
          attempts: nextAttempts,
          lastError: error.message,
          nextAttemptAt: finalFailure
            ? new Date()
            : new Date(Date.now() + getBackoffMs(nextAttempts)),
        },
      });
      emitJobUpdate(io, failedJob);
      return failedJob;
    }
  } finally {
    activeJobs.delete(jobId);
  }
}

async function enqueueMessage({
  userId,
  messageId,
  sessionManager,
  io,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  processNow = true,
} = {}) {
  const message = await loadMessageForUser(userId, messageId);
  if (!message) {
    throw new Error("Outbound message was not found.");
  }

  const transport = resolveTransport(message);
  const job = await prisma.outboundDeliveryJob.upsert({
    where: { messageId },
    create: {
      userId,
      messageId,
      transport,
      maxAttempts,
      status: "queued",
      nextAttemptAt: new Date(),
    },
    update: {
      transport,
      maxAttempts,
      status: { set: "queued" },
      nextAttemptAt: new Date(),
    },
  });

  emitJobUpdate(io, job);
  if (!processNow) return job;
  return processJob(job.id, { sessionManager, io });
}

async function processDueJobs({ sessionManager, io, limit = 25, userId } = {}) {
  const jobs = await prisma.outboundDeliveryJob.findMany({
    where: {
      status: "queued",
      nextAttemptAt: { lte: new Date() },
      ...(userId ? { userId } : {}),
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const results = [];
  for (const job of jobs) {
    results.push(await processJob(job.id, { sessionManager, io }));
  }
  return results.filter(Boolean);
}

function startWorker({
  sessionManager,
  io,
  intervalMs = DEFAULT_WORKER_INTERVAL_MS,
} = {}) {
  workerContext = { sessionManager, io };
  if (workerTimer) return;

  workerTimer = setInterval(() => {
    processDueJobs(workerContext).catch((error) => {
      console.error("Outbound delivery worker failed:", error);
    });
  }, intervalMs);

  if (workerTimer.unref) workerTimer.unref();
}

function stopWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  workerContext = null;
}

async function listJobs(userId, { status, chatId, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  return prisma.outboundDeliveryJob.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(chatId ? { message: { chatId } } : {}),
    },
    include: {
      message: {
        include: {
          mediaFile: true,
          chat: {
            include: { contact: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: safeLimit,
  });
}

async function retryJob(userId, jobId, { sessionManager, io } = {}) {
  const job = await prisma.outboundDeliveryJob.findFirst({
    where: { id: jobId, userId },
  });
  if (!job) {
    throw new Error("Outbound delivery job was not found.");
  }

  const resetJob = await prisma.outboundDeliveryJob.update({
    where: { id: job.id },
    data: {
      status: "queued",
      attempts: 0,
      lastError: null,
      deliveredAt: null,
      nextAttemptAt: new Date(),
    },
  });
  emitJobUpdate(io, resetJob);
  return processJob(resetJob.id, { sessionManager, io });
}

module.exports = {
  DEFAULT_MAX_ATTEMPTS,
  enqueueMessage,
  processDueJobs,
  processJob,
  startWorker,
  stopWorker,
  listJobs,
  retryJob,
  serializeJob,
};
