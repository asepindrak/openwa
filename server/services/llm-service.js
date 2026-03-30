const aiProviderService = require("./ai-provider-service");

async function generate(userId, params = {}) {
  const { providerId } = params || {};

  if (!providerId) {
    throw new Error("providerId is required.");
  }

  const provider = await aiProviderService.getProvider(userId, providerId);
  if (!provider) {
    throw new Error("AI provider not found.");
  }

  const adapterName = provider.provider;

  try {
    const adapter = require(`../ai/llm-adapters/${adapterName}`);
    if (typeof adapter.generate !== "function") {
      throw new Error("Adapter does not implement generate().");
    }

    // Pass the provider-specific config as the first arg and params as second
    const result = await adapter.generate(provider.config || {}, params || {});
    return result;
  } catch (err) {
    throw new Error(`LLM generate failed: ${err.message}`);
  }
}

module.exports = {
  generate,
};
