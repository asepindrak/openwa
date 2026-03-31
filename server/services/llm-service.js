const aiProviderService = require("./ai-provider-service");
const userSettings = require("./user-settings");

async function generate(userId, params = {}) {
  const { providerId } = params || {};

  // Prefer explicit providerId from params; fallback to user's default provider
  const resolvedProviderId =
    providerId ||
    (await userSettings.getSetting(userId, "defaultAiProviderId"));

  if (!resolvedProviderId) {
    throw new Error("providerId is required.");
  }

  const provider = await aiProviderService.getProvider(
    userId,
    resolvedProviderId,
  );
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
    // Allow user's default model to be used when params.model not provided
    const modelFromUser = await userSettings.getSetting(
      userId,
      "defaultAiModel",
    );
    const finalParams = { ...(params || {}) };
    if (!finalParams.model) {
      finalParams.model =
        finalParams.model ||
        modelFromUser ||
        (provider.config && provider.config.model) ||
        undefined;
    }

    const result = await adapter.generate(
      provider.config || {},
      finalParams || {},
    );
    return result;
  } catch (err) {
    throw new Error(`LLM generate failed: ${err.message}`);
  }
}

module.exports = {
  generate,
};
