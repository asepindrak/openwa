#!/usr/bin/env node
(async () => {
  try {
    const { prisma } = require("../server/database/client");
    const rows = await prisma.terminalCommand.findMany({
      orderBy: { requestedAt: "desc" },
      take: 40,
    });
    for (const r of rows) {
      if (!/copilot|powershell/i.test(r.command || "")) continue;
      console.log("---");
      console.log("id:", r.id);
      console.log("command:", r.command);
      console.log("cwd:", r.cwd);
      console.log("status:", r.status);
      const s = (r.stdout || "").toString();
      const e = (r.stderr || "").toString();
      console.log("stdout (truncated 800):");
      console.log(s.slice(0, 800));
      if (s.length > 800) console.log("... (truncated)");
      console.log("stderr (truncated 800):");
      console.log(e.slice(0, 800));
      if (e.length > 800) console.log("... (truncated)");
    }
    process.exit(0);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
