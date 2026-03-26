export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:55222";
}

export async function apiFetch(url, options = {}) {
  const target = `${getApiBaseUrl()}${url}`;
  const authHeaders = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.apiKey ? { "X-API-Key": options.apiKey } : {})
  };
  const response = await fetch(target, {
    method: options.method || "GET",
    headers: options.formData
      ? {
          ...authHeaders
        }
      : {
          "Content-Type": "application/json",
          ...authHeaders
        },
    body: options.formData || (options.body ? JSON.stringify(options.body) : undefined)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}
