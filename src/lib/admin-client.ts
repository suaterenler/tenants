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

function writeToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

export function storeToken(token: string | null): void {
  writeToken(token);
  if (!token) authChannel()?.postMessage({ type: "logout" });
}

const AUTH_CHANNEL = "erenler_tenants_auth";
const ASK_WAIT_MS = 400;
const tokenListeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let askedAt = 0;

function notifyToken(): void {
  tokenListeners.forEach((listener) => listener());
}

function authChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  channel = new BroadcastChannel(AUTH_CHANNEL);
  channel.onmessage = (event: MessageEvent<{ type?: string; token?: string }>) => {
    const data = event.data;
    if (data?.type === "ask") {
      const token = readToken();
      if (token) channel?.postMessage({ type: "token", token });
    } else if (data?.type === "token" && data.token && !readToken()) {
      writeToken(data.token);
      notifyToken();
    } else if (data?.type === "logout" && readToken()) {
      writeToken(null);
      notifyToken();
    }
  };
  return channel;
}

export function subscribeToken(callback: () => void): () => void {
  tokenListeners.add(callback);
  const bus = authChannel();
  if (bus && !readToken() && !askedAt) {
    askedAt = Date.now();
    bus.postMessage({ type: "ask" });
    window.setTimeout(notifyToken, ASK_WAIT_MS + 50);
  }
  return () => {
    tokenListeners.delete(callback);
  };
}

export function tokenState(): boolean | null {
  if (readToken()) return true;
  if (typeof BroadcastChannel !== "undefined" && (!askedAt || Date.now() - askedAt < ASK_WAIT_MS)) return null;
  return false;
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

export function sessionExpired(): void {
  storeToken(null);
  if (typeof window !== "undefined") window.location.replace(BASE_PATH);
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
  if (response.status === 401 && headers.Authorization && !path.startsWith("/login") && !path.startsWith("/password")) sessionExpired();
  const payload = (await response.json().catch(() => null)) as ApiBody<T> | null;
  if (!payload) throw new AdminRequestError(`HTTP ${response.status}`, response.status);
  if (!payload.ok) throw new AdminRequestError(payload.error, response.status, payload.code ?? "");
  return payload.data;
}
