const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE_URL = (rawApiBaseUrl ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL is not configured. Frontend must call BidMart through API Gateway.",
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function jsonHeaders(headers?: HeadersInit): Headers {
  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  return mergedHeaders;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    headers: jsonHeaders(init.headers),
  });
}

export function authHeaders(token: string, headers?: HeadersInit): Headers {
  const mergedHeaders = jsonHeaders(headers);
  mergedHeaders.set("Authorization", `Bearer ${token}`);
  return mergedHeaders;
}
