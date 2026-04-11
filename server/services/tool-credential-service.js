const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { storageDir, ensureRuntimeDirs } = require("../utils/paths");

const CRED_PATH = path.join(storageDir, "tools_credentials.json");

function ensureFile() {
  try {
    ensureRuntimeDirs();
  } catch (e) {
    // ignore
  }

  if (!fs.existsSync(CRED_PATH)) {
    try {
      fs.writeFileSync(CRED_PATH, "{}", "utf8");
    } catch (e) {
      // ignore
    }
  }
}

function getMasterKey() {
  const source = process.env.OPENWA_SECRET || process.env.JWT_SECRET || null;
  if (!source) return null;
  return crypto.createHash("sha256").update(String(source)).digest();
}

function readStore() {
  ensureFile();
  try {
    const raw = fs.readFileSync(CRED_PATH, "utf8") || "{}";
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  fs.writeFileSync(CRED_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function saveCredential(
  userId,
  toolId,
  { apiKey, headerName = "Authorization" } = {},
) {
  if (!apiKey) throw new Error("apiKey is required");
  const key = getMasterKey();
  if (!key)
    throw new Error(
      "OPENWA_SECRET or JWT_SECRET must be set to store credentials securely",
    );

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(String(apiKey), "utf8", "base64");
  enc += cipher.final("base64");
  const tag = cipher.getAuthTag();

  const store = readStore();
  const storeKey = `${toolId}:${userId}`;
  store[storeKey] = {
    toolId,
    headerName: headerName || "Authorization",
    secret: enc,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    addedBy: userId,
    addedAt: new Date().toISOString(),
  };

  writeStore(store);
  return { ok: true };
}

async function getCredentialForUser(userId, toolId) {
  const store = readStore();
  const storeKey = `${toolId}:${userId}`;
  const entry = store[storeKey];
  if (!entry) return null;
  const key = getMasterKey();
  if (!key) return null;
  try {
    const iv = Buffer.from(entry.iv, "base64");
    const tag = Buffer.from(entry.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let dec = decipher.update(entry.secret, "base64", "utf8");
    dec += decipher.final("utf8");
    return {
      apiKey: dec,
      headerName: entry.headerName,
      addedBy: entry.addedBy,
      addedAt: entry.addedAt,
    };
  } catch (e) {
    return null;
  }
}

async function removeCredentialForUser(userId, toolId) {
  const store = readStore();
  const storeKey = `${toolId}:${userId}`;
  if (!store[storeKey]) throw new Error("credential not found");
  delete store[storeKey];
  writeStore(store);
  return { ok: true };
}

module.exports = {
  saveCredential,
  getCredentialForUser,
  removeCredentialForUser,
  readStore,
};
