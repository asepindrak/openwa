const EventEmitter = require("events");
const QRCode = require("qrcode");
const path = require("path");
const { sessionsDir, rootDir } = require("../../utils/paths");

class WwebjsAdapter extends EventEmitter {
  constructor({ session }) {
    super();
    this.session = session;
    this.client = null;
  }

  async connect() {
    const { Client, LocalAuth } = require("whatsapp-web.js");

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.session.id,
        dataPath: sessionsDir
      }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      }
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
        lastError: typeof reason === "string" ? reason : "Disconnected"
      });
    });

    this.client.on("auth_failure", (message) => {
      this.emit("status", {
        status: "error",
        transportType: "wwebjs",
        lastError: message
      });
    });

    this.client.on("message", (message) => {
      const chatId = String(message.from || "");
      const isPrivateChat = chatId.endsWith("@c.us");
      const isGroupChat = chatId.endsWith("@g.us");

      if (!isPrivateChat && !isGroupChat) {
        return;
      }

      this.emit("message", {
        sender: chatId,
        displayName: message._data?.notifyName || message._data?.pushname || chatId,
        body: message.body,
        type: "text"
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

    const [contacts, chats] = await Promise.all([this.client.getContacts(), this.client.getChats()]);
    const chatSnapshots = [];

    for (const chat of chats) {
      const externalId = chat.id?._serialized || "";
      if (!externalId.endsWith("@c.us") && !externalId.endsWith("@g.us")) {
        continue;
      }

      const messages = await chat.fetchMessages({ limit: 50 });
      chatSnapshots.push({
        externalId,
        name: chat.name || chat.formattedTitle || externalId,
        pushname: chat.name || chat.formattedTitle || externalId,
        messages: messages.map((message) => ({
          externalMessageId: message.id?._serialized || null,
          sender: message.fromMe ? `user:${this.session.userId}` : message.author || message.from || externalId,
          body: message.body || null,
          type: message.type,
          direction: message.fromMe ? "outbound" : "inbound",
          ack: message.ack ?? 0,
          createdAt: new Date((message.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString()
        }))
      });
    }

    return {
      contacts: contacts.map((contact) => ({
        externalId: contact.id?._serialized || "",
        name: contact.name || contact.shortName || "",
        pushname: contact.pushname || contact.name || ""
      })),
      chats: chatSnapshots
    };
  }

  async sendMessage(payload) {
    if (!this.client) {
      throw new Error("WhatsApp client is not ready.");
    }

    if (payload.mediaFileId) {
      const { MessageMedia } = require("whatsapp-web.js");
      const mediaPath = path.join(rootDir, "storage", payload.mediaPath || "");

      const media = MessageMedia.fromFilePath(mediaPath);
      const response = await this.client.sendMessage(payload.recipient, media, payload.body ? { caption: payload.body } : undefined);
      return {
        externalMessageId: response.id?._serialized || null
      };
    }

    const response = await this.client.sendMessage(payload.recipient, payload.body || "");
    return {
      externalMessageId: response.id?._serialized || null
    };
  }
}

module.exports = { WwebjsAdapter };
