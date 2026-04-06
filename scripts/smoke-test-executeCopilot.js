#!/usr/bin/env node
const path = require("path");
(async () => {
  try {
    const agent = require("../server/services/agent-service");
    const { prisma } = require("../server/database/client");
    // ensure a test user exists for foreign key constraints
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
    console.log("Calling code agent orchestrator...");
    const orchestrator = require("../server/services/agent-orchestrator");
    const { workspacesDir } = require("../server/utils/paths");
    const cwd = path.join(workspacesDir, "smoke-test-" + Date.now());
    const res = await orchestrator.orchestrate({
      userId: user.id,
      message: 'Create a README.md with one line: "Hello from smoke test".',
      context: { cwd },
      maxSteps: 6,
    });
    console.log("Result:", JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error("Error running smoke test:", e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
