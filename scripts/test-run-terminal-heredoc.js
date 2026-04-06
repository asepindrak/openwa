const executor = require("../server/services/tool-executor");

(async () => {
  try {
    const cmd =
      "mkdir -p article-api && cd article-api && cat > index.js <<'JS'\nconsole.log('hello from heredoc');\nJS && echo done";
    const res = await executor.executeTool({
      action: "run_terminal",
      data: { command: cmd },
      userId: "test-user",
    });
    console.log("Result:", JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error("Error:", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
