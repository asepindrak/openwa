#!/usr/bin/env node
const agent = require("../server/services/agent-service");

async function main() {
  const url = "https://dokploy.sehatierp.com/swagger";
  const apiKey = process.env.DOKPLOY_API_KEY || process.argv[2];
  if (!apiKey) {
    console.error(
      "DOKPLOY_API_KEY not set. Usage: DOKPLOY_API_KEY=... node scripts/test-register-dokploy.js",
    );
    process.exit(1);
  }

  const headerCandidates = ["Authorization", "X-API-Key", "x-api-key"];
  let result = null;
  let usedHeader = null;

  for (const headerName of headerCandidates) {
    try {
      console.log(`Attempting register with header ${headerName} ...`);
      result = await agent.fetchAndRegisterTool("e2e-dokploy", {
        url,
        apiKey,
        headerName,
        overwrite: true,
      });
      usedHeader = headerName;
      console.log("Registration successful with header", headerName);
      console.log(JSON.stringify(result, null, 2));
      break;
    } catch (err) {
      console.error(
        `Register failed with header ${headerName}:`,
        err.message || err,
      );
    }
  }

  if (!result) {
    console.error("All registration attempts failed.");
    process.exit(2);
  }

  const toolId = result.tool && result.tool.id;
  if (!toolId) {
    console.error("No tool id returned; stopping.");
    process.exit(3);
  }

  // Try invoking a simple path to validate invocation. Pass apiKey/headerName for protected endpoints.
  try {
    console.log("\nAttempting simple invoke (GET /) using stored tool id...");
    const invokeRes = await agent.invokeRegisteredTool("e2e-dokploy", toolId, {
      method: "GET",
      path: "/",
      apiKey,
      headerName: usedHeader,
      timeout: 15000,
    });

    console.log("Invoke result summary:");
    console.log("ok=", invokeRes.ok, "status=", invokeRes.status);
    console.log("headers:", invokeRes.headers);
    console.log(
      "body (truncated):",
      typeof invokeRes.body === "string"
        ? invokeRes.body.slice(0, 400)
        : invokeRes.body,
    );
  } catch (err) {
    console.error("Invoke attempt failed:", err.message || err);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Unexpected error:", e && e.stack ? e.stack : e);
  process.exit(99);
});
