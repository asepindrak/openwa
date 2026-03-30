const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { rootDir } = require("../utils/paths");

const storePath = path.join(rootDir, "storage", "webhooks.json");

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

async function deliver(cfg, payload) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openwa-webhook-key": cfg.apiKey || "",
    },
    body: JSON.stringify(payload),
  });
  return res;
}

module.exports = {
  getWebhook: (userId) => {
    const store = readStore();
    return store[userId] || null;
  },

  setWebhook: (userId, cfg) => {
    const store = readStore();
    store[userId] = cfg;
    writeStore(store);
    return cfg;
  },

  deleteWebhook: (userId) => {
    const store = readStore();
    delete store[userId];
    writeStore(store);
  },

  notifyWebhook: async (userId, payload) => {
    const cfg = module.exports.getWebhook(userId);
    if (!cfg || !cfg.url) return;

    try {
      await deliver(cfg, payload);
    } catch (err) {
      console.error("Failed to deliver webhook for user", userId, err);
    }
  },
};
