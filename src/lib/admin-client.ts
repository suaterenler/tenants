export const BASE_PATH = "/admin";
export const TOKEN_KEY = "erenler_tenants_token";

export type ApiBody<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

export class AdminRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers = authHeaders();
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE_PATH}/api${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as ApiBody<T> | null;
  if (!payload) throw new AdminRequestError(`HTTP ${response.status}`, response.status);
  if (!payload.ok) throw new AdminRequestError(payload.error, response.status, payload.code ?? "");
  return payload.data;
}
