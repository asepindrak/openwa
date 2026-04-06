const executor = require("../server/services/tool-executor");

(async () => {
  try {
    const res = await executor.executeTool({
      action: "write_files",
      data: {
        files: [
          {
            path: "test-output/hello.txt",
            content: "Hello from test-write-files",
          },
          {
            path: "/test-output/abs-path.txt",
            content: "Absolute-style path should be normalized",
          },
        ],
      },
      userId: "test-user",
    });
    console.log("Result:", res);
    process.exit(0);
  } catch (e) {
    console.error("Error:", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
