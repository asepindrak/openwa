const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const storageDir = path.join(rootDir, "storage");
const sessionsDir = path.join(storageDir, "sessions");
const mediaDir = path.join(storageDir, "media");
const databaseDir = path.join(storageDir, "database");
const prismaSchemaPath = path.join(rootDir, "prisma", "schema.prisma");
const webDir = path.join(rootDir, "web");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureRuntimeDirs() {
  [storageDir, sessionsDir, mediaDir, databaseDir].forEach(ensureDir);
}

module.exports = {
  rootDir,
  storageDir,
  sessionsDir,
  mediaDir,
  databaseDir,
  prismaSchemaPath,
  webDir,
  ensureRuntimeDirs
};
