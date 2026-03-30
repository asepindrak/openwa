#!/usr/bin/env node
const http = require("http");
const path = require("path");
const fs = require("fs");

const {
  registerExternalTool,
  invokeRegisteredTool,
} = require("../server/services/agent-service");

const server = http.createServer((req, res) => {
  if (req.url === "/hello") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hello: "world" }));
    return;
  }

  if (req.url === "/echo" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ got: body, headers: req.headers }));
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(0, async () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log("Local tool server at", base);

  const manifest = {
    id: "test_invoke_tool",
    name: "Test Invoke Tool",
    description: "Tool with explicit HTTP invoke base",
    docs: `${base}/docs`,
    invoke: base,
  };

  try {
    const reg = await registerExternalTool("e2e-user", manifest, {
      overwrite: true,
    });
    console.log("Registered tool:", reg.tool.id);

    const getRes = await invokeRegisteredTool("e2e-user", reg.tool.id, {
      method: "GET",
      path: "/hello",
    });
    console.log("\nGET /hello result:", getRes);

    const postRes = await invokeRegisteredTool("e2e-user", reg.tool.id, {
      method: "POST",
      path: "/echo",
      body: { msg: "ping" },
    });
    console.log("\nPOST /echo result:", postRes);

    console.log("\nInvoke tests completed successfully.");
  } catch (err) {
    console.error("Invoke tests failed:", err.message || err);
    process.exitCode = 2;
  } finally {
    server.close(() => console.log("local server stopped"));
  }
});
