// Minimal OpenAI adapter stub
// Exports: listModels(config) and generate(config, params)
module.exports = {
  listModels: async function (config = {}) {
    try {
      const pkg = require("openai");
      const OpenAI = pkg?.default || pkg?.OpenAI || pkg;
      const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
      if (apiKey && OpenAI) {
        const client = new OpenAI({ apiKey });
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
      // ignore - fall back to defaults below
    }

    return [
      { id: "gpt-4", name: "gpt-4" },
      { id: "gpt-3.5-turbo", name: "gpt-3.5-turbo" },
    ];
  },

  generate: async function (config = {}, params = {}) {
    const apiKey = (config && config.apiKey) || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key missing. Provide config.apiKey or set OPENAI_API_KEY.",
      );
    }

    if (typeof fetch !== "function") {
      throw new Error(
        "fetch is not available in this Node runtime. Run on Node 18+ or provide a fetch polyfill.",
      );
    }

    const host =
      (config && (config.host || process.env.OPENAI_HOST)) ||
      "https://api.openai.com";
    const base = String(host).replace(/\/$/, "");
    const model = params.model || (config && config.model) || "gpt-3.5-turbo";

    // Chat-style request
    if (Array.isArray(params.messages) && params.messages.length) {
      const url = `${base}/v1/chat/completions`;
      const body = {
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI request failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      const text =
        data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
      return { text, raw: data };
    }

    // Prompt/completions-style request
    if (params.prompt || params.prompt === "" || params.prompt === 0) {
      const url = `${base}/v1/completions`;
      const body = {
        model,
        prompt: params.prompt,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI request failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.text ?? "";
      return { text, raw: data };
    }

    throw new Error("No messages or prompt provided to OpenAI adapter.");
  },
};
