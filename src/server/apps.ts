import "server-only";

export type ProgramModule = { key: string; label: string };
export type TenantRecord = {
  slug: string;
  name: string;
  active: boolean;
  expiresAt: string | null;
  contactName: string;
  phone: string;
  email: string;
  disabledModules: string[];
  domains: string[];
  createdAt: string;
};
export type Program = { key: string; name: string; publicPath: string; publicUrl: string | null; agentUrl: string; rootUrl: string; hostOnly: boolean };
export type ProgramInfo = { key: string; name: string; publicPath: string; publicUrl: string | null; rootPort: number | null; hostOnly: boolean; online: boolean; modules: ProgramModule[] };

function portOf(url: string): number | null {
  try {
    const port = Number(new URL(url).port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}
export type ProgramTenant = TenantRecord & { app: string };

export function programList(): Program[] {
  return [
    { key: "education", name: "Eğitim", publicPath: "/education", publicUrl: process.env.EDUCATION_PUBLIC_URL?.trim() || null, agentUrl: process.env.EDUCATION_URL?.trim() || "http://127.0.0.1:3052/education", rootUrl: process.env.EDUCATION_ROOT_URL?.trim() || "http://127.0.0.1:3053", hostOnly: false },
    { key: "salon", name: "Salon", publicPath: "/salon", publicUrl: process.env.SALON_PUBLIC_URL?.trim() || null, agentUrl: process.env.SALON_URL?.trim() || "http://127.0.0.1:3054/salon", rootUrl: process.env.SALON_ROOT_URL?.trim() || "http://127.0.0.1:3055", hostOnly: false },
    { key: "cms", name: "CMS", publicPath: "/cms", publicUrl: process.env.CMS_PUBLIC_URL?.trim() || null, agentUrl: process.env.CMS_URL?.trim() || "http://127.0.0.1:3057", rootUrl: process.env.CMS_ROOT_URL?.trim() || "http://127.0.0.1:3057", hostOnly: false },
    { key: "ecommerce", name: "E-Ticaret", publicPath: "/ecommerce", publicUrl: process.env.ECOMMERCE_PUBLIC_URL?.trim() || null, agentUrl: process.env.ECOMMERCE_URL?.trim() || "http://127.0.0.1:3059", rootUrl: process.env.ECOMMERCE_ROOT_URL?.trim() || "http://127.0.0.1:3059", hostOnly: false },
  ];
}

export function findApp(key: string): Program | null {
  return programList().find((app) => app.key === key) ?? null;
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

export function tenantsSecret(): string {
  const value = (process.env.TENANTS_SECRET ?? process.env.PLATFORM_SECRET)?.trim() ?? "";
  if (value.length < 32) throw new AgentError("programUnavailable", "TENANTS_SECRET tanımlı değil.", 502);
  return value;
}

async function parseAgentBody<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as AgentBody<T> | null;
  if (!payload) throw new AgentError("programUnavailable", `HTTP ${response.status}`, 502);
  if (!payload.ok) throw new AgentError((payload.code ?? "programUnavailable").replace(/^errors\./, "").replace(/^platform/, "tenant"), payload.error, response.status);
  return payload.data;
}

export async function agentCall<T>(app: Program, path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${app.agentUrl}/admin/api/agent${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${tenantsSecret()}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs ?? 5000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError("programUnavailable", "unreachable", 502);
  }
  return parseAgentBody<T>(response);
}

export async function agentSend<T>(app: Program, path: string, body: ArrayBuffer, timeoutMs = 10 * 60 * 1000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${app.agentUrl}/admin/api/agent${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantsSecret()}`, "Content-Type": "application/zip" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError("programUnavailable", "unreachable", 502);
  }
  return parseAgentBody<T>(response);
}

export async function overview(): Promise<{ apps: ProgramInfo[]; tenants: ProgramTenant[] }> {
  const results = await Promise.all(
    programList().map(async (app) => {
      try {
        const [records, modules] = await Promise.all([agentCall<TenantRecord[]>(app, "/tenants"), agentCall<ProgramModule[]>(app, "/modules")]);
        return { info: { key: app.key, name: app.name, publicPath: app.publicPath, publicUrl: app.publicUrl, rootPort: portOf(app.rootUrl), hostOnly: app.hostOnly, online: true, modules }, tenants: records.map((record) => ({ ...record, domains: record.domains ?? [], app: app.key })) };
      } catch {
        return { info: { key: app.key, name: app.name, publicPath: app.publicPath, publicUrl: app.publicUrl, rootPort: portOf(app.rootUrl), hostOnly: app.hostOnly, online: false, modules: [] }, tenants: [] };
      }
    }),
  );
  return { apps: results.map((result) => result.info), tenants: results.flatMap((result) => result.tenants) };
}

export async function agentStream(app: Program, path: string, timeoutMs = 30 * 60 * 1000): Promise<Response> {
  try {
    return await fetch(`${app.agentUrl}/admin/api/agent${path}`, {
      headers: { Authorization: `Bearer ${tenantsSecret()}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError("programUnavailable", "unreachable", 502);
  }
}

export type DomainRoute = { domain: string; app: string; slug: string; target: string };

export async function domainRoutes(): Promise<{ routes: DomainRoute[]; complete: boolean }> {
  const { apps, tenants } = await overview();
  const routes = tenants.flatMap((tenant) => {
    const app = findApp(tenant.app);
    return app ? tenant.domains.map((domain) => ({ domain, app: app.key, slug: tenant.slug, target: app.rootUrl })) : [];
  });
  return { routes, complete: apps.every((app) => app.online) };
}

export async function domainConflict(domains: string[], app: string, slug: string): Promise<string | null> {
  if (domains.length === 0) return null;
  const { tenants } = await overview();
  const owner = tenants.find((tenant) => !(tenant.app === app && tenant.slug === slug) && tenant.domains.some((domain) => domains.includes(domain)));
  return owner ? owner.domains.find((domain) => domains.includes(domain)) ?? null : null;
}

export function tenantPublicAddress(app: Pick<Program, "publicUrl" | "publicPath" | "hostOnly">, origin: string, slug: string, domains: string[] = []): string {
  if (domains[0]) return `https://${domains[0]}`;
  if (app.hostOnly) return "";
  return `${(app.publicUrl ?? `${origin.replace(/\/+$/, "")}${app.publicPath}`).replace(/\/+$/, "")}/${slug}`;
}
