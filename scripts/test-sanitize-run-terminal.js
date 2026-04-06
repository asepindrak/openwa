const terminalService = require("../server/services/terminal-service");
// override requestExecution to capture command
terminalService.requestExecution = async (userId, args, io) => {
  console.log("Intercepted command:", args.command);
  return {
    ok: true,
    id: "stub",
    executed: true,
    result: { stdout: "", stderr: "" },
  };
};

const executor = require("../server/services/tool-executor");

(async () => {
  const cmd =
    "set -e mkdir -p article-api/data article-api/utils article-api/routes cd article-api npm init -y npm install express uuid";
  const res = await executor.executeTool({
    action: "run_terminal",
    data: { command: cmd },
    userId: "test-user",
  });
  console.log("Result:", JSON.stringify(res, null, 2));
})();
