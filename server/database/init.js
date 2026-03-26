const { spawnSync } = require("child_process");
const { prisma } = require("./client");
const { ensureRuntimeDirs, prismaSchemaPath, rootDir } = require("../utils/paths");

function runPrismaCommand(args) {
  const prismaCli = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, ...args, "--schema", prismaSchemaPath], {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Prisma command failed: prisma ${args.join(" ")}\n${output}`);
  }
}

async function initializeDatabase() {
  ensureRuntimeDirs();
  runPrismaCommand(["generate"]);
  runPrismaCommand(["db", "push"]);
  await prisma.$connect();
}

module.exports = {
  initializeDatabase
};
