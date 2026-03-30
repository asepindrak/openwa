#!/usr/bin/env node
const http = require("http");
const path = require("path");
const fs = require("fs");

const { fetchAndRegisterTool } = require("../server/services/agent-service");

const manifest = {
  id: "test_tool_auto_1",
  name: "Test Tool Auto 1",
  description: "Automatically registered test tool (E2E).",
  example: { q: "hello" },
};

const server = http.createServer((req, res) => {
  if (req.url === "/manifest") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(manifest));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(0, async function () {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/manifest`;
  console.log("Serving manifest at", url);

  try {
    const result = await fetchAndRegisterTool("test-user-e2e", {
      url,
      overwrite: true,
    });
    console.log("\nfetchAndRegisterTool result:");
    console.log(JSON.stringify(result, null, 2));

    const { storageDir } = require("../server/utils/paths");
    const registryPath = path.join(storageDir, "tools_registry.json");
    const toolsMdPath = path.join(storageDir, "TOOLS.md");

    if (fs.existsSync(registryPath)) {
      const raw = fs.readFileSync(registryPath, "utf8");
      try {
        const reg = JSON.parse(raw || "{}");
        console.log("\nRegistry keys:", Object.keys(reg));
        console.log("\nRegistry entry for", manifest.id, ":", reg[manifest.id]);
      } catch (e) {
        console.log("Failed to parse registry JSON:", e.message);
      }
    } else {
      console.log("\nNo tools_registry.json found");
    }

    if (fs.existsSync(toolsMdPath)) {
      const md = fs.readFileSync(toolsMdPath, "utf8");
      console.log("\nTOOLS.md snippet (tail 800 chars):\n");
      console.log(md.slice(-800));
    } else {
      console.log("\nNo TOOLS.md found");
    }

    console.log("\nE2E test completed successfully.");
  } catch (err) {
    console.error("\nE2E test failed:", err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    server.close(() => console.log("manifest server stopped"));
  }
});
