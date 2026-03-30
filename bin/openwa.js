#!/usr/bin/env node

const { startOpenWA } = require("../server");

const dev = process.argv.includes("--dev");

console.log("\x1b[36m[OpenWA]\x1b[0m Initializing... Please wait.");

startOpenWA({ dev }).catch((error) => {
  console.error("Failed to start OpenWA.");
  console.error(error);
  process.exit(1);
});
