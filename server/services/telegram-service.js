const { Telegraf, Input } = require("telegraf");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../database/client");
const toolCredentialService = require("./tool-credential-service");
const TelegramConfigService = require("./telegram-config-service");
const chatService = require("./chat-service");
const { mediaDir } = require("../utils/paths");

let bots = {}; // userId -> Telegraf instance
let ioInstance = null;

class TelegramService {
  static setIo(io) {
    ioInstance = io;
  }

  static async startBot(userId, token) {
    if (bots[userId]) {
      try {
        await bots[userId].stop();
      } catch (e) {}
    }

    const bot = new Telegraf(token);

    bot.start((ctx) => {
      ctx.reply(
        "Halo! Saya adalah OpenWA Assistant. Anda bisa meremote OpenWA melalui bot ini.",
      );
    });

    bot.on("text", async (ctx) => {
      const telegramChatId = String(ctx.chat.id);
      const allowedIds = (
        TelegramConfigService.getConfig(userId)?.adminTelegramIds || []
      ).map(String);
      const text = ctx.message.text;

      if (allowedIds.length > 0 && !allowedIds.includes(telegramChatId)) {
        await ctx.reply(
          "Maaf, akun Telegram Anda belum diizinkan untuk mengontrol OpenWA. Hubungi pemilik untuk menambahkan chat ID Anda.",
        );
        return;
      }

      // Find or create a contact for this Telegram chat
      let contact = await prisma.contact.findFirst({
        where: {
          userId,
          externalId: `tg:${telegramChatId}`,
        },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            userId,
            externalId: `tg:${telegramChatId}`,
            displayName: ctx.from.first_name || "Telegram User",
            avatarUrl: null,
          },
        });
      }

      const normalizedText = String(text || "").trim();
      if (normalizedText.toLowerCase() === "/new") {
        const newChat = await chatService.createAssistantConversation(
          userId,
          {},
        );
        if (ioInstance) {
          ioInstance.to(`user:${userId}`).emit("contact_list_update", newChat);
        }
        await ctx.reply(
          "Konteks baru telah dimulai. Saya membuat sesi assistant baru untuk Anda.",
        );
        return;
      }

      // Find or create a chat linked to that contact
      let chat = await prisma.chat.findFirst({
        where: {
          userId,
          contactId: contact.id,
        },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            userId,
            title: contact.displayName,
            contactId: contact.id,
          },
        });
      }

      // Process message through AgentService
      const agentService = require("./agent-service");
      // We need to pass a context that includes a way to send back to Telegram
      await agentService.handleAssistantMessage(
        userId,
        chat.id,
        { body: text },
        {
          transport: "telegram",
          telegramCtx: ctx,
          io: ioInstance,
        },
      );
    });

    bot.launch();
    bots[userId] = bot;
    console.info(`[TelegramService] Bot started for user ${userId}`);
    return bot;
  }

  static async initializeAll() {
    console.info("[TelegramService] Initializing all Telegram bots...");
    const store = toolCredentialService.readStore();
    for (const key in store) {
      if (key.startsWith("telegram_bot:")) {
        const [_, userId] = key.split(":");
        try {
          const cred = await toolCredentialService.getCredentialForUser(
            userId,
            "telegram_bot",
          );
          if (cred && cred.apiKey) {
            await TelegramService.startBot(userId, cred.apiKey);
          }
        } catch (e) {
          console.error(
            `[TelegramService] Failed to initialize bot for user ${userId}:`,
            e,
          );
        }
      }
    }
  }

  static async stopBot(userId) {
    if (bots[userId]) {
      try {
        await bots[userId].stop();
      } catch (e) {}
      delete bots[userId];
    }
  }

  static isBotRunning(userId) {
    return Boolean(bots[userId]);
  }

  static async stopAll() {
    console.info("[TelegramService] Stopping all Telegram bots...");
    for (const userId in bots) {
      await TelegramService.stopBot(userId);
    }
  }

  static async sendMessage(userId, telegramChatId, text) {
    const bot = bots[userId];
    if (bot) {
      await bot.telegram.sendMessage(telegramChatId, text);
    }
  }

  static async sendMedia(userId, telegramChatId, mediaFile, caption) {
    const bot = bots[userId];
    if (!bot || !mediaFile) return;

    const relativePath = String(mediaFile.relativePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .trim();
    const normalized = relativePath.startsWith("media/")
      ? relativePath.slice("media/".length)
      : relativePath;
    const filePath = path.join(mediaDir, normalized);

    if (fs.existsSync(filePath)) {
      const mimeType = String(mediaFile.mimeType || "").toLowerCase();
      if (mimeType.startsWith("image/")) {
        await bot.telegram.sendPhoto(
          telegramChatId,
          Input.fromLocalFile(filePath),
          {
            caption,
          },
        );
      } else if (mimeType.startsWith("video/")) {
        await bot.telegram.sendVideo(
          telegramChatId,
          Input.fromLocalFile(filePath),
          {
            caption,
          },
        );
      } else if (mimeType.startsWith("audio/")) {
        await bot.telegram.sendAudio(
          telegramChatId,
          Input.fromLocalFile(filePath),
          {
            caption,
          },
        );
      } else {
        await bot.telegram.sendDocument(
          telegramChatId,
          Input.fromLocalFile(filePath),
          { caption },
        );
      }
    } else {
      // Fallback to text if file missing
      await bot.telegram.sendMessage(
        telegramChatId,
        (caption ? caption + "\n" : "") + "[Media file missing]",
      );
    }
  }

  static isTelegramChat(externalId) {
    return String(externalId || "").startsWith("tg:");
  }

  static extractTelegramId(externalId) {
    return String(externalId || "").replace(/^tg:/, "");
  }
}

module.exports = TelegramService;
