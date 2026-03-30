(async () => {
  try {
    const path = require("path");
    const { runShellCommand } = require("../server/services/terminal-service");
    const { workspacesDir } = require("../server/utils/paths");
    const workspaceDir = workspacesDir;
    console.log("Workspace dir:", workspaceDir);
    const res = await runShellCommand(
      process.platform === "win32" ? "pwd" : "pwd",
      10000,
      workspaceDir,
    );
    console.log("Result:", JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
})();
