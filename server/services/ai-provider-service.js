const { prisma } = require("../database/client");

async function retryOnSqliteTimeout(operation) {
  let lastError = null;
  for (const delayMs of [0, 100, 250, 500]) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      return await operation();
    } catch (error) {
      if (error?.code !== "P1008") {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}

function sanitizeProvider(record) {
  if (!record) return null;
  return {
    id: record.id,
    provider: record.provider,
    name: record.name,
    config: record.config,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function listProviders(userId) {
  const items = await retryOnSqliteTimeout(() =>
    prisma.aiProvider.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  );

  return items.map(sanitizeProvider);
}

async function getProvider(userId, providerId) {
  const record = await retryOnSqliteTimeout(() =>
    prisma.aiProvider.findFirst({ where: { id: providerId, userId } }),
  );

  return sanitizeProvider(record);
}

async function createProvider(userId, { provider, name, config }) {
  const trimmedName = String(name || "").trim();
  const providerKey = String(provider || "")
    .toLowerCase()
    .trim();

  if (!providerKey) {
    throw new Error("Provider is required.");
  }

  if (!trimmedName) {
    throw new Error("Provider name is required.");
  }

  const record = await retryOnSqliteTimeout(() =>
    prisma.aiProvider.create({
      data: {
        userId,
        provider: providerKey,
        name: trimmedName,
        config: config || {},
      },
    }),
  );

  return sanitizeProvider(record);
}

async function updateProvider(userId, providerId, { name, config }) {
  const existing = await retryOnSqliteTimeout(() =>
    prisma.aiProvider.findFirst({ where: { id: providerId, userId } }),
  );

  if (!existing) {
    throw new Error("AI provider not found.");
  }

  const updated = await retryOnSqliteTimeout(() =>
    prisma.aiProvider.update({
      where: { id: providerId },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(config !== undefined ? { config } : {}),
      },
    }),
  );

  return sanitizeProvider(updated);
}

async function deleteProvider(userId, providerId) {
  const existing = await retryOnSqliteTimeout(() =>
    prisma.aiProvider.findFirst({ where: { id: providerId, userId } }),
  );

  if (!existing) {
    throw new Error("AI provider not found.");
  }

  await retryOnSqliteTimeout(() =>
    prisma.aiProvider.delete({ where: { id: providerId } }),
  );
  return { ok: true };
}

async function fetchModels(userId, providerId) {
  const provider = await getProvider(userId, providerId);
  if (!provider) {
    throw new Error("Provider not found.");
  }

  const adapterName = provider.provider;

  try {
    // Adapter modules should live under server/ai/llm-adapters/<adapter>.js
    const adapter = require(`../ai/llm-adapters/${adapterName}`);
    if (typeof adapter.listModels !== "function") {
      throw new Error("Adapter does not implement listModels().");
    }

    const models = await adapter.listModels(provider.config || {});
    return models;
  } catch (err) {
    throw new Error(
      `Failed to fetch models for provider ${adapterName}: ${err.message}`,
    );
  }
}

module.exports = {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  fetchModels,
};
