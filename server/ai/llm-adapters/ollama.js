// Minimal Ollama adapter stub
module.exports = {
  listModels: async function (config = {}) {
    try {
      // Ollama commonly exposes a local API (e.g., http://localhost:11434/api/models)
      // If user provided a host, we could fetch models. Keep this optional.
      const host = config.host || process.env.OLLAMA_HOST;
      if (host && typeof fetch === "function") {
        try {
          const res = await fetch(`${host.replace(/\/$/, "")}/api/models`);
          if (res.ok) {
            const data = await res.json();
            return (data || []).map((m) => ({
              id: m.name || m.id,
              name: m.name || m.id,
            }));
          }
        } catch (e) {
          // ignore network errors
        }
      }
    } catch (e) {
      // ignore
    }

    return [
      { id: "llama2", name: "llama2" },
      { id: "mistral", name: "mistral" },
    ];
  },

  generate: async function (config = {}, params = {}) {
    if (typeof fetch !== "function") {
      throw new Error(
        "fetch is not available in this Node runtime. Run on Node 18+ or provide a fetch polyfill.",
      );
    }

    const host =
      config.host || process.env.OLLAMA_HOST || "http://localhost:11434";
    const base = String(host).replace(/\/$/, "");
    const model = params.model || (config && config.model);
    if (!model) {
      throw new Error(
        "Ollama model is required (config.model or params.model).",
      );
    }

    const prompt =
      params.prompt ||
      (Array.isArray(params.messages)
        ? params.messages.map((m) => m.content).join("\n")
        : "");

    const url = `${base}/api/generate`;
    const body = {
      model,
      prompt,
      max_tokens: params.max_tokens,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama request failed: ${res.status} ${text}`);
    }

    const data = await res.json().catch(() => null);
    const text =
      data?.text ||
      (Array.isArray(data?.results) && data.results[0]?.content) ||
      (Array.isArray(data?.output) && data.output[0]) ||
      "";

    return { text, raw: data };
  },
};
