#!/usr/bin/env node
const path = require("path");
(async () => {
  try {
    const agent = require("../server/services/agent-service");
    const { prisma } = require("../server/database/client");
    const { workspacesDir } = require("../server/utils/paths");
    // ensure test user
    let user = await prisma.user.findFirst({
      where: { email: "smoke-test@example.com" },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "smoke-test",
          email: "smoke-test@example.com",
          passwordHash: "smoke-test",
        },
      });
    }

    const cwd = path.join(workspacesDir, "e2e-test-force-" + Date.now());
    require("fs").mkdirSync(cwd, { recursive: true });

    const prompt = `Create the following files under the given working directory. Output ONLY a single JSON object with key \"files\" containing array of objects {path, content}. Do NOT include any prose. Files to create:\n- package.json with content {"name":"force-test","version":"1.0.0"}\n- README.md with one line: Hello force test`;

    console.log("Invoking code agent orchestrator with cwd=", cwd);
    const orchestrator = require("../server/services/agent-orchestrator");
    const res = await orchestrator.orchestrate({
      userId: user.id,
      message: prompt,
      context: { cwd },
      maxSteps: 6,
    });
    console.log("RES", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("ERR", e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
