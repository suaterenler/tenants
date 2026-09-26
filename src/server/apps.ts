import "server-only";

export type PlatformModule = { key: string; label: string };
export type TenantRecord = {
  slug: string;
  name: string;
  active: boolean;
  expiresAt: string | null;
  contactName: string;
  phone: string;
  email: string;
  disabledModules: string[];
  createdAt: string;
};
export type PlatformApp = { key: string; name: string; publicPath: string; agentUrl: string };
export type PlatformAppInfo = { key: string; name: string; publicPath: string; online: boolean; modules: PlatformModule[] };
export type PlatformTenant = TenantRecord & { app: string };

export function platformApps(): PlatformApp[] {
  return [
    { key: "education", name: "Education", publicPath: "/education", agentUrl: process.env.EDUCATION_URL?.trim() || "http://127.0.0.1:3043/education" },
    { key: "salon", name: "Salon", publicPath: "/salon", agentUrl: process.env.SALON_URL?.trim() || "http://127.0.0.1:3044/salon" },
  ];
}

export function findApp(key: string): PlatformApp | null {
  return platformApps().find((app) => app.key === key) ?? null;
}

export class AgentError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type AgentBody<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

function platformSecret(): string {
  const value = process.env.PLATFORM_SECRET?.trim() ?? "";
  if (value.length < 32) throw new AgentError("platformAppUnavailable", "PLATFORM_SECRET tanımlı değil.", 502);
  return value;
}

export async function agentCall<T>(app: PlatformApp, path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${app.agentUrl}/admin/api/agent${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${platformSecret()}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs ?? 5000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError("platformAppUnavailable", "unreachable", 502);
  }
  const payload = (await response.json().catch(() => null)) as AgentBody<T> | null;
  if (!payload) throw new AgentError("platformAppUnavailable", `HTTP ${response.status}`, 502);
  if (!payload.ok) throw new AgentError((payload.code ?? "platformAppUnavailable").replace(/^errors./, ""), payload.error, response.status);
  return payload.data;
}

export async function overview(): Promise<{ apps: PlatformAppInfo[]; tenants: PlatformTenant[] }> {
  const results = await Promise.all(
    platformApps().map(async (app) => {
      try {
        const [records, modules] = await Promise.all([agentCall<TenantRecord[]>(app, "/tenants"), agentCall<PlatformModule[]>(app, "/modules")]);
        return { info: { key: app.key, name: app.name, publicPath: app.publicPath, online: true, modules }, tenants: records.map((record) => ({ ...record, app: app.key })) };
      } catch {
        return { info: { key: app.key, name: app.name, publicPath: app.publicPath, online: false, modules: [] }, tenants: [] };
      }
    }),
  );
  return { apps: results.map((result) => result.info), tenants: results.flatMap((result) => result.tenants) };
}
