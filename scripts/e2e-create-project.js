#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
(async () => {
  try {
    const agent = require("../server/services/agent-service");
    const { prisma } = require("../server/database/client");
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

    const { workspacesDir } = require("../server/utils/paths");
    const base = workspacesDir;
    const dir = path.join(base, "e2e-test-" + Date.now());
    fs.mkdirSync(dir, { recursive: true });

    // write a minimal package.json to give Copilot some context
    const pkg = {
      name: "e2e-test-project",
      version: "1.0.0",
      scripts: { test: "echo test" },
    };
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(pkg, null, 2),
    );

    console.log("Created test project at", dir);

    const orchestrator = require("../server/services/agent-orchestrator");
    const res = await orchestrator.orchestrate({
      userId: user.id,
      message:
        'Create README.md with a single line: "Hello from e2e test" and create src/index.js that logs \"hello\" to console.',
      context: { cwd: dir },
      maxSteps: 6,
    });

    console.log("orchestrator result:", JSON.stringify(res, null, 2));

    // check for created files
    const readme = path.join(dir, "README.md");
    const index = path.join(dir, "src", "index.js");
    console.log("README exists:", fs.existsSync(readme));
    console.log("src/index.js exists:", fs.existsSync(index));

    if (fs.existsSync(readme))
      console.log("README content:\n", fs.readFileSync(readme, "utf8"));
    if (fs.existsSync(index))
      console.log("index.js content:\n", fs.readFileSync(index, "utf8"));

    process.exit(0);
  } catch (e) {
    console.error("E2E test error:", e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
