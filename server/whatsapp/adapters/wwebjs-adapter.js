const EventEmitter = require("events");
const QRCode = require("qrcode");
const path = require("path");
const {
  sessionsDir,
  storageDir,
  mediaDir,
  ensureRuntimeDirs,
} = require("../../utils/paths");

class WwebjsAdapter extends EventEmitter {
  constructor({ session }) {
    super();
    this.session = session;
    this.client = null;
  }

  async resolveProfilePic(externalId) {
    if (!this.client || !externalId) {
      return {
        url: null,
        status: "missing",
        reason: "client-not-ready-or-empty-id",
      };
    }

    const result = await this.client.pupPage.evaluate(async (contactId) => {
      try {
        const chatWid = window.Store.WidFactory.createWid(contactId);
        let profilePic = null;

        if (typeof window.Store.ProfilePic.profilePicFind === "function") {
          profilePic = await window.Store.ProfilePic.profilePicFind(chatWid);
        }

        if (
          !profilePic &&
          typeof window.Store.ProfilePic.requestProfilePicFromServer ===
            "function"
        ) {
          profilePic =
            await window.Store.ProfilePic.requestProfilePicFromServer(chatWid);
        }

        return (
          profilePic?.eurl || profilePic?.imgFull || profilePic?.img || null
        );
      } catch (error) {
        const message = String(error?.message || error || "");
        if (message.includes("isNewsletter")) {
          return {
            __status: "newsletter-guard",
          };
        }

        if (error?.name === "ServerStatusCodeError") {
          return {
            __status: "server-status",
          };
        }

        return {
          __error: {
            name: String(error?.name || "Error"),
            message,
          },
        };
      }
    }, externalId);

    if (result?.__error) {
      return {
        url: null,
        status: "error",
        reason: result.__error.message,
        errorName: result.__error.name,
      };
    }

    if (result?.__status === "newsletter-guard") {
      return {
        url: null,
        status: "newsletterGuard",
        reason: "wwebjs-newsletter-guard",
      };
    }

    if (result?.__status === "server-status") {
      return {
        url: null,
        status: "serverStatus",
        reason: "server-status-code-error",
      };
    }

    if (!result) {
      return {
        url: null,
        status: "missing",
        reason: "no-profile-photo-returned",
      };
    }

    return {
      url: result,
      status: "found",
      reason: "profile-photo-found",
    };
  }

  async resolveProfilePicUrl(externalId) {
    const result = await this.resolveProfilePic(externalId);
    if (result.status === "error") {
      console.warn(
        `Failed to fetch WhatsApp profile photo for ${externalId}: ${result.reason}`,
      );
    }

    return result.url;
  }

  async connect() {
    const { Client, LocalAuth } = require("whatsapp-web.js");

    try {
      ensureRuntimeDirs();
    } catch (e) {}

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.session.id,
        dataPath: sessionsDir,
      }),
      puppeteer: {
        headless: true,
        // Increase protocolTimeout to avoid Runtime.callFunctionOn timed out errors
        // when WhatsApp/puppeteer operations take longer on slow machines.
        protocolTimeout: 120000,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        timeout: 0,
        // store puppeteer profile/cache in the user data dir under storage
        userDataDir: path.join(storageDir, ".wwebjs_cache"),
      },
    });

    this.client.on("qr", async (qr) => {
      const qrCode = await QRCode.toDataURL(qr);
      this.emit("qr", { qrCode, transportType: "wwebjs" });
    });

    this.client.on("loading_screen", () => {
      this.emit("status", { status: "connecting", transportType: "wwebjs" });
    });

    this.client.on("ready", () => {
      this.emit("status", { status: "ready", transportType: "wwebjs" });
    });

    this.client.on("disconnected", (reason) => {
      this.emit("status", {
        status: "disconnected",
        transportType: "wwebjs",
        lastError: typeof reason === "string" ? reason : "Disconnected",
      });
    });

    this.client.on("auth_failure", (message) => {
      this.emit("status", {
        status: "error",
        transportType: "wwebjs",
        lastError: message,
      });
    });

    const fs = require("fs");
    const { v4: uuidv4 } = require("uuid");
    const { storeIncomingMessage } = require("../../services/chat-service");
    const { prisma } = require("../../database/client");
    // use mediaDir from paths so it's stored in the user data dir
    // (imported at top of file)

    this.client.on("message", (message) => {
      void (async () => {
        const chatId = String(message.from || "");
        const isPrivateChat = chatId.endsWith("@c.us");
        const isGroupChat = chatId.endsWith("@g.us");
        if (!isPrivateChat && !isGroupChat) return;

        let mediaFileId = null;
        let type = message.type || "text";
        let body = message.body;

        if (message.hasMedia) {
          try {
            const media = await message.downloadMedia();
            if (media && media.data) {
              if (!fs.existsSync(mediaDir))
                fs.mkdirSync(mediaDir, { recursive: true });
              const ext = media.mimetype.split("/")[1] || "bin";
              const filename = `${uuidv4()}.${ext}`;
              const filePath = path.join(mediaDir, filename);
              fs.writeFileSync(filePath, Buffer.from(media.data, "base64"));
              // Create media_files entry
              const mediaFile = await prisma.mediaFile.create({
                data: {
                  userId: this.session.userId,
                  fileName: filename,
                  originalName: filename,
                  mimeType: media.mimetype,
                  size: Buffer.from(media.data, "base64").length,
                  relativePath: `media/${filename}`,
                },
              });
              mediaFileId = mediaFile.id;
              type = message.type;
              // For images/videos, body is usually caption
              if (media.caption) body = media.caption;
            }
          } catch (err) {
            console.error("Failed to download WhatsApp media:", err);
          }
        }

        // Emit to backend (store in DB)
        await storeIncomingMessage({
          userId: this.session.userId,
          sessionId: this.session.id,
          sender: chatId,
          displayName:
            message._data?.notifyName || message._data?.pushname || chatId,
          avatarUrl: await this.resolveProfilePicUrl(chatId),
          body,
          type,
          mediaFileId,
        });
      })().catch((error) => {
        console.error("Failed to process incoming WhatsApp message.", error);
      });
    });

    await this.client.initialize();
  }

  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.emit("status", { status: "disconnected", transportType: "wwebjs" });
  }

  async getSyncSnapshot() {
    if (!this.client) {
      throw new Error("WhatsApp client is not ready.");
    }

    const [contacts, chats] = await Promise.all([
      this.client.getContacts(),
      this.client.getChats(),
    ]);
    const contactSnapshots = await Promise.all(
      contacts.map(async (contact) => {
        const externalId = contact.id?._serialized || "";
        const avatarResult = await this.resolveProfilePic(externalId);

        return {
          externalId,
          name: contact.name || contact.shortName || "",
          pushname: contact.pushname || contact.name || "",
          avatarUrl: avatarResult.url,
        };
      }),
    );
    const contactAvatarMap = new Map(
      contactSnapshots.map((contact) => [
        contact.externalId,
        contact.avatarUrl,
      ]),
    );
    const chatSnapshots = [];

    for (const chat of chats) {
      const externalId = chat.id?._serialized || "";
      if (!externalId.endsWith("@c.us") && !externalId.endsWith("@g.us")) {
        continue;
      }

      const messages = await chat.fetchMessages({ limit: 50 });
      const chatAvatarResult = contactAvatarMap.get(externalId)
        ? {
            url: contactAvatarMap.get(externalId),
            status: "found",
            reason: "reused-contact-avatar",
          }
        : await this.resolveProfilePic(externalId);

      chatSnapshots.push({
        externalId,
        name: chat.name || chat.formattedTitle || externalId,
        pushname: chat.name || chat.formattedTitle || externalId,
        avatarUrl: chatAvatarResult.url,
        messages: messages.map((message) => ({
          externalMessageId: message.id?._serialized || null,
          sender: message.fromMe
            ? `user:${this.session.userId}`
            : message.author || message.from || externalId,
          body: message.body || null,
          type: message.type,
          direction: message.fromMe ? "outbound" : "inbound",
          ack: message.ack ?? 0,
          createdAt: new Date(
            (message.timestamp || Math.floor(Date.now() / 1000)) * 1000,
          ).toISOString(),
        })),
      });
    }

    return {
      contacts: contactSnapshots,
      chats: chatSnapshots,
    };
  }

  async sendMessage(payload) {
    if (!this.client) {
      throw new Error("WhatsApp client is not ready.");
    }

    if (payload.mediaFileId) {
      const { MessageMedia } = require("whatsapp-web.js");
      const mediaPath = path.join(mediaDir, payload.mediaPath || "");

      const media = MessageMedia.fromFilePath(mediaPath);
      const response = await this.client.sendMessage(
        payload.recipient,
        media,
        payload.body ? { caption: payload.body } : undefined,
      );
      return {
        externalMessageId: response.id?._serialized || null,
      };
    }

    const response = await this.client.sendMessage(
      payload.recipient,
      payload.body || "",
    );
    return {
      externalMessageId: response.id?._serialized || null,
    };
  }
}

module.exports = { WwebjsAdapter };
