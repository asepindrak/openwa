const aiProviderService = require("./ai-provider-service");
const crmService = require("./crm-service");

function normalizeVector(vector) {
  if (!Array.isArray(vector)) return null;
  const values = vector.map(Number).filter((value) => Number.isFinite(value));
  return values.length ? values : null;
}

function cosineSimilarity(left, right) {
  const a = normalizeVector(left);
  const b = normalizeVector(right);
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    leftNorm += a[index] * a[index];
    rightNorm += b[index] * b[index];
  }

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Embedding request failed: ${response.status} ${text}`);
  }

  return response.json();
}

function resolveModel(provider, model) {
  return (
    model ||
    provider?.config?.embeddingModel ||
    provider?.config?.model ||
    (provider?.provider === "ollama" ? "nomic-embed-text" : "text-embedding-3-small")
  );
}

async function embedOpenAiCompatible(provider, texts, model) {
  const apiKey = provider.config?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Embedding API key is missing.");

  const host =
    provider.config?.host ||
    (provider.provider === "openrouter"
      ? "https://openrouter.ai/api"
      : "https://api.openai.com");
  const base = String(host).replace(/\/$/, "");
  const data = await postJson(
    `${base}/v1/embeddings`,
    { Authorization: `Bearer ${apiKey}` },
    { model, input: texts },
  );

  const vectors = (data.data || [])
    .sort((left, right) => (left.index || 0) - (right.index || 0))
    .map((item) => normalizeVector(item.embedding));
  if (vectors.some((vector) => !vector)) {
    throw new Error("Embedding response contained invalid vectors.");
  }
  return vectors;
}

async function embedOllama(provider, texts, model) {
  const host = provider.config?.host || "http://localhost:11434";
  const base = String(host).replace(/\/$/, "");
  const vectors = [];

  for (const text of texts) {
    const data = await postJson(`${base}/api/embeddings`, {}, {
      model,
      prompt: text,
    });
    const vector = normalizeVector(data.embedding);
    if (!vector) throw new Error("Ollama embedding response was invalid.");
    vectors.push(vector);
  }

  return vectors;
}

async function embedTexts(userId, texts, options = {}) {
  const cleanTexts = (texts || []).map((text) => String(text || ""));
  if (!cleanTexts.length) return [];

  const settings = options.settings || (await crmService.getSettings(userId));
  const providerId = options.providerId || settings.embeddingProviderId;
  if (!providerId) {
    return [];
  }

  const provider = await aiProviderService.getProvider(userId, providerId);
  if (!provider) throw new Error("Embedding provider not found.");

  const model = resolveModel(provider, options.model || settings.embeddingModel);
  const providerName = String(provider.provider || "").toLowerCase();
  const vectors =
    providerName === "ollama"
      ? await embedOllama(provider, cleanTexts, model)
      : await embedOpenAiCompatible(provider, cleanTexts, model);

  return vectors.map((embedding) => ({ embedding, model, providerId }));
}

module.exports = {
  embedTexts,
  cosineSimilarity,
  normalizeVector,
};
