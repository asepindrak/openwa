#!/usr/bin/env node
const agent = require("../server/services/agent-service");

async function main() {
  const base = "https://dokploy.sehatierp.com";
  const apiKey = process.env.DOKPLOY_API_KEY || process.argv[2];
  if (!apiKey) {
    console.error(
      "DOKPLOY_API_KEY not set. Usage: DOKPLOY_API_KEY=... node scripts/test-register-dokploy-openapi.js",
    );
    process.exit(1);
  }

  const candidates = [
    "/docs/json",
    "/swagger.json",
    "/openapi.json",
    "/v2/api-docs",
    "/docs/swagger.json",
    "/swagger/docs/v1",
    "/swagger/v1/swagger.json",
    "/openapi/v1.json",
  ];

  let registered = null;
  for (const p of candidates) {
    const url = base + p;
    try {
      console.log("Trying", url);
      const res = await agent.fetchAndRegisterTool("e2e-dokploy-openapi", {
        url,
        apiKey,
        headerName: "Authorization",
        overwrite: true,
      });
      console.log("-> register result:", res && res.tool && res.tool.invoke);
      if (res && res.ok) {
        registered = res;
        // prefer explicit OpenAPI imports
        if (res.tool && String(res.tool.invoke) === "openapi") break;
      }
    } catch (err) {
      console.error("-> failed:", err.message || err);
    }
  }

  if (!registered) {
    console.error("No manifest could be registered from candidates.");
    process.exit(2);
  }

  console.log("\nRegistered tool id:", registered.tool.id);
  console.log("invoke:", registered.tool.invoke, "docs:", registered.tool.docs);

  // If import looked like OpenAPI, try a simple invocation (as the registering user)
  try {
    console.log(
      "\nAttempting a simple GET / against the service to validate reachability...",
    );
    const invokeRes = await agent.invokeRegisteredTool(
      "e2e-dokploy-openapi",
      registered.tool.id,
      {
        method: "GET",
        path: "/",
        apiKey,
        headerName: "Authorization",
        timeout: 15000,
      },
    );

    console.log("Invoke ok=", invokeRes.ok, "status=", invokeRes.status);
  } catch (err) {
    console.error("Invoke test failed:", err.message || err);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Unexpected error:", e && e.stack ? e.stack : e);
  process.exit(99);
});
