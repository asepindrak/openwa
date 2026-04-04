const assert = require("assert");

(async () => {
  let originalGenerate = null;

  try {
    const { prisma } = require("../server/database/client");
    const aiProviderService = require("../server/services/ai-provider-service");
    const chatService = require("../server/services/chat-service");
    const agentService = require("../server/services/agent-service");
    const llmService = require("../server/services/llm-service");

    let user = await prisma.user.findFirst({
      where: { email: "assistant-fallback-test@example.com" },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Assistant Fallback Test",
          email: "assistant-fallback-test@example.com",
          passwordHash: "test",
        },
      });
    }

    const providerName = `Fallback Provider ${Date.now()}`;
    await aiProviderService.createProvider(user.id, {
      provider: "openai",
      name: providerName,
      config: { apiKey: "test-key" },
    });

    const assistantChat = await chatService.createAssistantConversation(
      user.id,
      {
        title: `Fallback Chat ${Date.now()}`,
      },
    );

    originalGenerate = llmService.generate;
    llmService.generate = async () => {
      throw new Error(
        'LLM generate failed: OpenAI request failed: 500 {"error":{"message":"Response contained no choices.","type":"server_error","code":500}}',
      );
    };

    const io = {
      to() {
        return {
          emit() {},
        };
      },
    };

    await agentService.handleAssistantMessage(
      user.id,
      assistantChat.id,
      { body: "tolong jawab ini", type: "text" },
      { io, config: {}, sessionManager: null, clientPlatform: "Windows" },
    );

    const messageResult = await chatService.listMessages(
      user.id,
      assistantChat.id,
      {
        take: 10,
      },
    );
    const messages = messageResult.messages || [];
    const latest = messages[messages.length - 1];

    assert(latest, "expected assistant fallback message to be stored");
    assert.equal(latest.direction, "inbound");
    assert.match(
      String(latest.body || ""),
      /provider sedang bermasalah sementara|pesan anda sudah diterima/i,
    );

    console.log("assistant llm fallback checks passed");
    process.exit(0);
  } catch (error) {
    console.error("assistant llm fallback checks failed:", error);
    process.exit(1);
  } finally {
    if (originalGenerate) {
      const llmService = require("../server/services/llm-service");
      llmService.generate = originalGenerate;
    }
  }
})();
