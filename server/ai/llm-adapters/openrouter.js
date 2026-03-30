// Minimal OpenRouter adapter stub
module.exports = {
  listModels: async function (config = {}) {
    try {
      const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
      const host = config.host || process.env.OPENROUTER_HOST;
      // If host is provided and fetch is available, attempt a request
      if ((host || apiKey) && typeof fetch === "function" && host) {
        try {
          const url = `${host.replace(/\/$/, "")}/models`;
          const res = await fetch(url, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            return (data || []).map((m) => ({
              id: m.id || m.name,
              name: m.name || m.id,
            }));
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    return [
      { id: "openrouter/gpt-4o-mini", name: "gpt-4o-mini" },
      { id: "openrouter/gpt-4", name: "gpt-4" },
    ];
  },

  generate: async function (config = {}, params = {}) {
    const apiKey = (config && config.apiKey) || process.env.OPENROUTER_API_KEY;
    const host =
      (config && (config.host || process.env.OPENROUTER_HOST)) ||
      "https://api.openrouter.ai";

    if (!apiKey && !host) {
      throw new Error(
        "OpenRouter requires a host or API key in config or environment.",
      );
    }

    if (typeof fetch !== "function") {
      throw new Error(
        "fetch is not available in this Node runtime. Run on Node 18+ or provide a fetch polyfill.",
      );
    }

    const base = String(host).replace(/\/$/, "");
    const model = params.model || (config && config.model) || "gpt-4";

    const url = `${base}/v1/chat/completions`;
    const body = {
      model,
      messages: params.messages,
      prompt: params.prompt,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter request failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const text =
      data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
    return { text, raw: data };
  },
};
