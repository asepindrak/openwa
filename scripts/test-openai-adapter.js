const assert = require("assert");

(async () => {
  const originalFetch = global.fetch;

  try {
    const openAiAdapter = require("../server/ai/llm-adapters/openai");
    const anthropicAdapter = require("../server/ai/llm-adapters/anthropic");
    const openRouterAdapter = require("../server/ai/llm-adapters/openrouter");
    const internal = openAiAdapter.__internal || {};

    assert.equal(
      typeof internal.postOpenAiJson,
      "function",
      "postOpenAiJson should be exposed for testing",
    );

    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;

      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          text: async () =>
            '{"error":{"message":"Response contained no choices.","type":"server_error","code":500}}',
        };
      }

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "recovered after retry",
              },
            },
          ],
        }),
      };
    };

    const result = await openAiAdapter.generate(
      { apiKey: "test-key", host: "https://example.invalid" },
      {
        model: "gpt-test",
        messages: [{ role: "user", content: "hello" }],
      },
    );

    assert.equal(callCount, 2, "adapter should retry once on retriable 500");
    assert.equal(result.text, "recovered after retry");

    let anthropicCallCount = 0;
    global.fetch = async () => {
      anthropicCallCount += 1;

      if (anthropicCallCount === 1) {
        return {
          ok: false,
          status: 529,
          text: async () =>
            '{"error":{"message":"overloaded_error","type":"server_error"}}',
        };
      }

      return {
        ok: true,
        json: async () => ({
          completion: "anthropic recovered after retry",
        }),
      };
    };

    const anthropicResult = await anthropicAdapter.generate(
      { apiKey: "test-key", host: "https://example.invalid" },
      {
        model: "claude-test",
        messages: [{ role: "user", content: "hello" }],
      },
    );

    assert.equal(
      anthropicCallCount,
      2,
      "anthropic adapter should retry once on retriable 5xx",
    );
    assert.equal(anthropicResult.text, "anthropic recovered after retry");

    let openRouterCallCount = 0;
    global.fetch = async () => {
      openRouterCallCount += 1;

      if (openRouterCallCount === 1) {
        return {
          ok: true,
          json: async () => ({ choices: [] }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "openrouter recovered after retry",
              },
            },
          ],
        }),
      };
    };

    const openRouterResult = await openRouterAdapter.generate(
      { apiKey: "test-key", host: "https://example.invalid" },
      {
        model: "openrouter-test",
        messages: [{ role: "user", content: "hello" }],
      },
    );

    assert.equal(
      openRouterCallCount,
      2,
      "openrouter adapter should retry once on empty choices",
    );
    assert.equal(openRouterResult.text, "openrouter recovered after retry");

    console.log("llm adapter retry checks passed");
    process.exit(0);
  } catch (error) {
    console.error("llm adapter retry checks failed:", error);
    process.exit(1);
  } finally {
    global.fetch = originalFetch;
  }
})();
