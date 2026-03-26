const EventEmitter = require("events");
const QRCode = require("qrcode");
const path = require("path");
const { sessionsDir, rootDir } = require("../../utils/paths");

function createAvatarDiagnosticsBucket() {
  return {
    total: 0,
    found: 0,
    missing: 0,
    newsletterGuard: 0,
    serverStatus: 0,
    error: 0,
    samples: {
      found: [],
      missing: [],
      newsletterGuard: [],
      serverStatus: [],
      error: []
    }
  };
}

function pushAvatarDiagnosticSample(bucket, status, detail) {
  const collection = bucket.samples[status];
  if (!collection || collection.length >= 5) {
    return;
  }

  collection.push(detail);
}

function summarizeAvatarDiagnostics(diagnostics) {
  return `contacts(total=${diagnostics.contacts.total}, found=${diagnostics.contacts.found}, missing=${diagnostics.contacts.missing}, newsletterGuard=${diagnostics.contacts.newsletterGuard}, serverStatus=${diagnostics.contacts.serverStatus}, error=${diagnostics.contacts.error}) chats(total=${diagnostics.chats.total}, found=${diagnostics.chats.found}, missing=${diagnostics.chats.missing}, newsletterGuard=${diagnostics.chats.newsletterGuard}, serverStatus=${diagnostics.chats.serverStatus}, error=${diagnostics.chats.error})`;
}

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
        reason: "client-not-ready-or-empty-id"
      };
    }

    const result = await this.client.pupPage.evaluate(async (contactId) => {
      try {
        const chatWid = window.Store.WidFactory.createWid(contactId);
        let profilePic = null;

        if (typeof window.Store.ProfilePic.profilePicFind === "function") {
          profilePic = await window.Store.ProfilePic.profilePicFind(chatWid);
        }

        if (!profilePic && typeof window.Store.ProfilePic.requestProfilePicFromServer === "function") {
          profilePic = await window.Store.ProfilePic.requestProfilePicFromServer(chatWid);
        }

        return profilePic?.eurl || profilePic?.imgFull || profilePic?.img || null;
      } catch (error) {
        const message = String(error?.message || error || "");
        if (message.includes("isNewsletter")) {
          return {
            __status: "newsletter-guard"
          };
        }

        if (error?.name === "ServerStatusCodeError") {
          return {
            __status: "server-status"
          };
        }

        return {
          __error: {
            name: String(error?.name || "Error"),
            message
          }
        };
      }
    }, externalId);

    if (result?.__error) {
      return {
        url: null,
        status: "error",
        reason: result.__error.message,
        errorName: result.__error.name
      };
    }

    if (result?.__status === "newsletter-guard") {
      return {
        url: null,
        status: "newsletterGuard",
        reason: "wwebjs-newsletter-guard"
      };
    }

    if (result?.__status === "server-status") {
      return {
        url: null,
        status: "serverStatus",
        reason: "server-status-code-error"
      };
    }

    if (!result) {
      return {
        url: null,
        status: "missing",
        reason: "no-profile-photo-returned"
      };
    }

    return {
      url: result,
      status: "found",
      reason: "profile-photo-found"
    };
  }

  async resolveProfilePicUrl(externalId) {
    const result = await this.resolveProfilePic(externalId);
    if (result.status === "error") {
      console.warn(`Failed to fetch WhatsApp profile photo for ${externalId}: ${result.reason}`);
    }

    return result.url;
  }

  registerAvatarDiagnostic(bucket, detail) {
    bucket.total += 1;
    if (detail.status === "found") {
      bucket.found += 1;
      pushAvatarDiagnosticSample(bucket, "found", {
        externalId: detail.externalId
      });
      return;
    }

    if (detail.status === "newsletterGuard") {
      bucket.newsletterGuard += 1;
      pushAvatarDiagnosticSample(bucket, "newsletterGuard", {
        externalId: detail.externalId,
        reason: detail.reason
      });
      return;
    }

    if (detail.status === "serverStatus") {
      bucket.serverStatus += 1;
      pushAvatarDiagnosticSample(bucket, "serverStatus", {
        externalId: detail.externalId,
        reason: detail.reason
      });
      return;
    }

    if (detail.status === "error") {
      bucket.error += 1;
      pushAvatarDiagnosticSample(bucket, "error", {
        externalId: detail.externalId,
        reason: detail.reason,
        errorName: detail.errorName || null
      });
      return;
    }

    bucket.missing += 1;
    pushAvatarDiagnosticSample(bucket, "missing", {
      externalId: detail.externalId,
      reason: detail.reason
    });
  }

  logAvatarDiagnostics(diagnostics) {
    console.log(`[OpenWA][AvatarDiagnostics][session:${this.session.id}] ${summarizeAvatarDiagnostics(diagnostics)}`);

    const sampleGroups = [
      ["contact-missing", diagnostics.contacts.samples.missing],
      ["contact-newsletter-guard", diagnostics.contacts.samples.newsletterGuard],
      ["contact-server-status", diagnostics.contacts.samples.serverStatus],
      ["contact-error", diagnostics.contacts.samples.error],
      ["chat-missing", diagnostics.chats.samples.missing],
      ["chat-newsletter-guard", diagnostics.chats.samples.newsletterGuard],
      ["chat-server-status", diagnostics.chats.samples.serverStatus],
      ["chat-error", diagnostics.chats.samples.error]
    ];

    for (const [label, samples] of sampleGroups) {
      if (!samples.length) {
        continue;
      }

      console.log(`[OpenWA][AvatarDiagnostics][session:${this.session.id}][${label}] ${JSON.stringify(samples)}`);
    }
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
      void (async () => {
        const chatId = String(message.from || "");
        const isPrivateChat = chatId.endsWith("@c.us");
        const isGroupChat = chatId.endsWith("@g.us");

        if (!isPrivateChat && !isGroupChat) {
          return;
        }

        this.emit("message", {
          sender: chatId,
          displayName: message._data?.notifyName || message._data?.pushname || chatId,
          avatarUrl: await this.resolveProfilePicUrl(chatId),
          body: message.body,
          type: "text"
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

    const [contacts, chats] = await Promise.all([this.client.getContacts(), this.client.getChats()]);
    const diagnostics = {
      contacts: createAvatarDiagnosticsBucket(),
      chats: createAvatarDiagnosticsBucket()
    };
    const contactSnapshots = await Promise.all(
      contacts.map(async (contact) => {
        const externalId = contact.id?._serialized || "";
        const avatarResult = await this.resolveProfilePic(externalId);
        this.registerAvatarDiagnostic(diagnostics.contacts, {
          externalId,
          status: avatarResult.status,
          reason: avatarResult.reason,
          errorName: avatarResult.errorName || null
        });

        return {
          externalId,
          name: contact.name || contact.shortName || "",
          pushname: contact.pushname || contact.name || "",
          avatarUrl: avatarResult.url
        };
      })
    );
    const contactAvatarMap = new Map(contactSnapshots.map((contact) => [contact.externalId, contact.avatarUrl]));
    const chatSnapshots = [];

    for (const chat of chats) {
      const externalId = chat.id?._serialized || "";
      if (!externalId.endsWith("@c.us") && !externalId.endsWith("@g.us")) {
        continue;
      }

      const messages = await chat.fetchMessages({ limit: 50 });
      const chatAvatarResult = contactAvatarMap.get(externalId)
        ? { url: contactAvatarMap.get(externalId), status: "found", reason: "reused-contact-avatar" }
        : await this.resolveProfilePic(externalId);

      this.registerAvatarDiagnostic(diagnostics.chats, {
        externalId,
        status: chatAvatarResult.status,
        reason: chatAvatarResult.reason,
        errorName: chatAvatarResult.errorName || null
      });

      chatSnapshots.push({
        externalId,
        name: chat.name || chat.formattedTitle || externalId,
        pushname: chat.name || chat.formattedTitle || externalId,
        avatarUrl: chatAvatarResult.url,
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

    this.logAvatarDiagnostics(diagnostics);

    return {
      contacts: contactSnapshots,
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
