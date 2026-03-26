#!/usr/bin/env node

const { startOpenWA } = require("../server");

const dev = process.argv.includes("--dev");

startOpenWA({ dev }).catch((error) => {
  console.error("Failed to start OpenWA.");
  console.error(error);
  process.exit(1);
});
