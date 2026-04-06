#!/usr/bin/env node
(async () => {
  try {
    const { prisma } = require("../server/database/client");
    const rows = await prisma.terminalCommand.findMany({
      orderBy: { requestedAt: "desc" },
      take: 20,
    });
    console.log("Recent terminal commands:");
    for (const r of rows) {
      console.log("---");
      console.log("id:", r.id);
      console.log("userId:", r.userId);
      console.log("command:", r.command);
      console.log("cwd:", r.cwd);
      console.log("status:", r.status);
      console.log("requestedAt:", r.requestedAt);
    }
    process.exit(0);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
