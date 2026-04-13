export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
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
