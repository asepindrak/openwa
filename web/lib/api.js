const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.has(String(hostname || "").toLowerCase());
}

export function getApiBaseUrl() {
  const configuredUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:55222",
  );

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  // If the frontend is served over HTTPS and the configured backend URL is HTTP
  // on the same host, use the secure current origin to avoid mixed content.
  if (
    window.location.protocol === "https:" &&
    configuredUrl.startsWith("http://")
  ) {
    try {
      const resolvedUrl = new URL(configuredUrl);
      if (resolvedUrl.hostname === window.location.hostname) {
        return window.location.origin;
      }
    } catch {
      // Ignore parse errors and continue.
    }
  }

  try {
    const resolvedUrl = new URL(configuredUrl);

    if (isLoopbackHost(resolvedUrl.hostname)) {
      resolvedUrl.hostname = window.location.hostname;
    }

    return normalizeBaseUrl(resolvedUrl.toString());
  } catch {
    return configuredUrl;
  }
}

function detectPlatform() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua) || /Mac OS X/i.test(ua))
    return "macOS";
  if (/Linux/i.test(platform) || /X11/i.test(ua)) return "Linux";
  return "Unknown";
}

export async function apiFetch(url, options = {}) {
  const target = `${getApiBaseUrl()}${url}`;
  const clientPlatform =
    typeof navigator !== "undefined" ? detectPlatform() : null;
  const authHeaders = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.apiKey ? { "X-API-Key": options.apiKey } : {}),
    ...(clientPlatform ? { "X-Client-Platform": clientPlatform } : {}),
  };
  const response = await fetch(target, {
    method: options.method || "GET",
    headers: options.formData
      ? {
          ...authHeaders,
        }
      : {
          "Content-Type": "application/json",
          ...authHeaders,
        },
    body:
      options.formData ||
      (options.body ? JSON.stringify(options.body) : undefined),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}
