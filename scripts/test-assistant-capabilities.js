const assert = require("assert");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const { prisma } = require("../server/database/client");
    const agentService = require("../server/services/agent-service");
    const terminalService = require("../server/services/terminal-service");
    const userSettings = require("../server/services/user-settings");
    const { ensureRuntimeDirs, mediaDir } = require("../server/utils/paths");

    const internal = agentService.__internal || {};
    assert.equal(
      typeof internal.resolveDirectAssistantToolCall,
      "function",
      "resolveDirectAssistantToolCall should be exported for verification",
    );
    assert.equal(
      typeof internal.buildAssistantSystemPrompt,
      "function",
      "buildAssistantSystemPrompt should be exported for verification",
    );
    assert.equal(
      typeof internal.buildMessageContentForLLM,
      "function",
      "buildMessageContentForLLM should be exported for verification",
    );
    assert.equal(
      typeof internal.buildLlmUserContent,
      "function",
      "buildLlmUserContent should be exported for verification",
    );
    assert.equal(
      typeof internal.getTerminalCommandForTool,
      "function",
      "getTerminalCommandForTool should be exported for verification",
    );

    const direct = internal.resolveDirectAssistantToolCall("buka notepad", {
      clientPlatform: "Windows",
    });
    assert(direct, "expected a direct tool call for 'buka notepad'");
    assert.equal(direct.tool, "run_terminal");
    assert.equal(direct.args.approvalMode, "auto");
    assert.equal(direct.args.trustedAuto, true);
    assert.match(direct.args.command, /notepad/i);

    const prompt = internal.buildAssistantSystemPrompt({
      assistantDisplayName: "Ops Assistant",
      assistantExternalId: "openwa:assistant:test",
      assistantPersona: "Always act decisively and use tools when appropriate.",
      toolsText: "- run_terminal",
      openapiText: "{}",
      identityText: "locale: id-ID",
      clientPlatform: "win32",
    });
    assert.match(prompt, /Always act decisively/i);
    assert.match(prompt, /openwa:assistant:test/i);
    assert.match(prompt, /run_terminal/i);
    assert.match(prompt, /locale: id-ID/i);

    const attachmentContent = internal.buildMessageContentForLLM({
      body: "tolong cek gambar ini",
      mediaFile: {
        originalName: "sample.png",
        mimeType: "image/png",
        relativePath: "media/sample.png",
      },
    });
    assert.match(attachmentContent, /tolong cek gambar ini/i);
    assert.match(attachmentContent, /sample\.png/i);
    assert.match(attachmentContent, /image\/png/i);

    ensureRuntimeDirs();
    const imageFixturePath = path.join(mediaDir, "assistant-test-image.png");
    fs.writeFileSync(
      imageFixturePath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9VE3DgAAAABJRU5ErkJggg==",
        "base64",
      ),
    );

    const multimodalContent = internal.buildLlmUserContent({
      body: "kamu tahu ini gambar apa?",
      mediaFile: {
        originalName: "assistant-test-image.png",
        mimeType: "image/png",
        relativePath: "media/assistant-test-image.png",
        size: fs.statSync(imageFixturePath).size,
      },
      providerName: "openai",
    });

    assert(Array.isArray(multimodalContent));
    assert.equal(multimodalContent[0]?.type, "text");
    assert.match(multimodalContent[0]?.text || "", /gambar apa/i);
    assert.equal(multimodalContent[1]?.type, "image_url");
    assert.match(
      multimodalContent[1]?.image_url?.url || "",
      /^data:image\/png;base64,/i,
    );

    assert.equal(
      internal.getTerminalCommandForTool(
        "run_terminal",
        { command: "npm install lodash" },
        { id: "terminal-1" },
      ),
      "npm install lodash",
    );
    assert.match(
      internal.getTerminalCommandForTool(
        "run_code_agent",
        {},
        { id: "terminal-2", command: 'copilot -sp "install axios"' },
      ) || "",
      /copilot -sp/i,
    );

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Assistant Capability Test",
          email: `assistant-capability-${Date.now()}@example.com`,
          passwordHash: "test",
        },
      });
    }

    await userSettings.setSetting(
      user.id,
      "autoApproveAllTerminalCommands",
      true,
    );

    const autoOverride = await terminalService.requestExecution(
      user.id,
      {
        command:
          process.platform === "win32"
            ? "echo openwa-auto-override"
            : "echo openwa-auto-override",
        approvalMode: "manual",
        chatId: "chat-auto-override",
        timeout: 5000,
      },
      null,
    );

    assert.equal(
      autoOverride.executed,
      true,
      "user auto-approve setting should override manual approval requests",
    );
    assert.equal(autoOverride.result.exitCode, 0);
    assert.match(
      String(autoOverride.result.stdout || ""),
      /openwa-auto-override/i,
    );
    assert.equal(autoOverride.chatId, "chat-auto-override");

    const exec = await terminalService.requestExecution(
      user.id,
      {
        command:
          process.platform === "win32"
            ? "echo openwa-trusted-auto"
            : "echo openwa-trusted-auto",
        approvalMode: "auto",
        trustedAuto: true,
        chatId: "chat-trusted-auto",
        timeout: 5000,
      },
      null,
    );

    assert.equal(
      exec.executed,
      true,
      "trusted auto execution should run immediately",
    );
    assert.equal(typeof exec.id, "string");
    assert.equal(exec.chatId, "chat-trusted-auto");
    assert.equal(exec.result.exitCode, 0);
    assert.match(String(exec.result.stdout || ""), /openwa-trusted-auto/i);

    await userSettings.setSetting(
      user.id,
      "autoApproveAllTerminalCommands",
      false,
    );

    console.log("assistant capability checks passed");
    process.exit(0);
  } catch (error) {
    console.error("assistant capability checks failed:", error);
    process.exit(1);
  }
})();
