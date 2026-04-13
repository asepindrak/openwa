const fs = require("fs");
const path = require("path");
const { storageDir, ensureRuntimeDirs } = require("../utils/paths");

const CONFIG_PATH = path.join(storageDir, "telegram_bot_config.json");

function ensureFile() {
  try {
    ensureRuntimeDirs();
  } catch (e) {
    // ignore
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    try {
      fs.writeFileSync(CONFIG_PATH, "{}", "utf8");
    } catch (e) {
      // ignore
    }
  }
}

function readStore() {
  ensureFile();
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8") || "{}";
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  ensureRuntimeDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2), "utf8");
}

function getConfig(userId) {
  const store = readStore();
  return store[String(userId)] || null;
}

function saveConfig(userId, config) {
  const store = readStore();
  store[String(userId)] = Object.assign(
    {},
    store[String(userId)] || {},
    config,
  );
  writeStore(store);
  return store[String(userId)];
}

function deleteConfig(userId) {
  const store = readStore();
  delete store[String(userId)];
  writeStore(store);
}

module.exports = {
  getConfig,
  saveConfig,
  deleteConfig,
};
