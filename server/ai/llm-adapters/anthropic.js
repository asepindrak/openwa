function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasAnthropicText(data) {
  return Boolean(data?.completion || data?.output);
}

function isRetriableAnthropicFailure(status, bodyText, data) {
  if (status >= 500) return true;
  if (data && !hasAnthropicText(data)) return true;
  return /overloaded|server_error|no completion|empty/i.test(
    String(bodyText || ""),
  );
}

async function postAnthropicJson(url, apiKey, body, maxAttempts = 2) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastError = new Error(`Anthropic request failed: ${res.status} ${text}`);
      if (
        attempt < maxAttempts &&
        isRetriableAnthropicFailure(res.status, text)
      ) {
        await delay(250 * attempt);
        continue;
      }
      throw lastError;
    }

    const data = await res.json();
    if (!hasAnthropicText(data)) {
      lastError = new Error("Anthropic response contained no completion.");
      if (attempt < maxAttempts) {
        await delay(250 * attempt);
        continue;
      }
      throw lastError;
    }

    return data;
  }

  throw lastError || new Error("Anthropic request failed.");
}

// Minimal Anthropic adapter stub
module.exports = {
  listModels: async function (config = {}) {
    try {
      const pkg = require("@anthropic-ai/sdk");
      const Anthropic = pkg?.Anthropic || pkg?.default || pkg;
      const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
      if (apiKey && Anthropic) {
        const client = new Anthropic({ apiKey });
        if (client.models && typeof client.models.list === "function") {
          const resp = await client.models.list();
          const items = resp?.data || [];
          return items.map((m) => ({
            id: m.id,
            name: m.id,
            description: m.description || "",
          }));
        }
      }
    } catch (e) {
      // ignore
    }

    return [
      { id: "claude-2", name: "claude-2" },
      { id: "claude-instant", name: "claude-instant" },
    ];
  },

  generate: async function (config = {}, params = {}) {
    const apiKey = (config && config.apiKey) || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Anthropic API key missing. Provide config.apiKey or set ANTHROPIC_API_KEY.",
      );
    }

    if (typeof fetch !== "function") {
      throw new Error(
        "fetch is not available in this Node runtime. Run on Node 18+ or provide a fetch polyfill.",
      );
    }

    const host =
      (config && (config.host || process.env.ANTHROPIC_HOST)) ||
      "https://api.anthropic.com";
    const base = String(host).replace(/\/$/, "");
    const model = params.model || (config && config.model) || "claude-2";

    let prompt = "";
    if (Array.isArray(params.messages) && params.messages.length) {
      // Convert messages array into Anthropic-style prompt
      prompt =
        params.messages
          .map((m) => {
            const role = (m.role || "user").toLowerCase();
            if (role === "assistant") return `\n\nAssistant: ${m.content}`;
            if (role === "system") return `\n\nSystem: ${m.content}`;
            return `\n\nHuman: ${m.content}`;
          })
          .join("") + "\n\nAssistant:";
    } else if (params.prompt) {
      prompt = params.prompt;
    } else {
      throw new Error("No messages or prompt provided to Anthropic adapter.");
    }

    const url = `${base}/v1/complete`;
    const body = {
      model,
      prompt,
      max_tokens_to_sample: params.max_tokens || params.maxTokens || 512,
      temperature: params.temperature ?? 0.0,
    };

    const data = await postAnthropicJson(url, apiKey, body);
    const text = data?.completion ?? data?.output ?? "";
    return { text, raw: data };
  },
  __internal: {
    delay,
    hasAnthropicText,
    isRetriableAnthropicFailure,
    postAnthropicJson,
  },
};
