#!/usr/bin/env node

const { startOpenWA } = require("../server");

const dev = process.argv.includes("--dev");
console.log("\x1b[36m[OpenWA]\x1b[0m Initializing... Please wait.");

// Friendly Windows startup hint about shell quoting issues
if (process.platform === "win32") {
  console.log(
    "\x1b[33m[OpenWA]\x1b[0m Running on Windows — if you see PowerShell quoting errors, try using Git Bash or run commands in a bash-compatible shell.",
  );
  console.log(
    "\x1b[33m[OpenWA]\x1b[0m For npm script environment variables use 'cross-env' for cross-platform compatibility.",
  );
}

console.log("\x1b[36m[OpenWA]\x1b[0m Initializing... Please wait.");

startOpenWA({ dev }).catch((error) => {
  console.error("Failed to start OpenWA.");
  console.error(error);
  process.exit(1);
});
