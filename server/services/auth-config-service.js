const fs = require("fs");
const path = require("path");
const { storageDir, ensureRuntimeDirs } = require("../utils/paths");

const CONFIG_PATH = path.join(storageDir, "auth_config.json");

function ensureFile() {
  try {
    ensureRuntimeDirs();
  } catch (e) {
    // ignore
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    try {
      fs.writeFileSync(
        CONFIG_PATH,
        JSON.stringify({ allowRegistration: false }, null, 2),
        "utf8",
      );
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
    return { allowRegistration: false };
  }
}

function writeStore(store) {
  ensureRuntimeDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2), "utf8");
}

function getConfig() {
  const store = readStore();
  return {
    allowRegistration:
      store.allowRegistration === undefined ? false : !!store.allowRegistration,
  };
}

function saveConfig(config = {}) {
  const existing = readStore();
  const store = Object.assign({}, existing, {
    allowRegistration:
      config.allowRegistration === undefined
        ? existing.allowRegistration === undefined
          ? false
          : !!existing.allowRegistration
        : !!config.allowRegistration,
  });
  writeStore(store);
  return getConfig();
}

module.exports = {
  getConfig,
  saveConfig,
};
