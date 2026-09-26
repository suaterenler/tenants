import { AgentError, agentCall, findApp, overview, type TenantRecord } from "@/server/apps";
import { fail, ok, readBody, requireSession } from "@/server/auth";
import { filterTenants, paginate, parseTenantQuery, todayIn } from "@/server/tenant-query";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const query = parseTenantQuery(new URL(request.url).searchParams);
  const { apps, tenants } = await overview();
  const filtered = filterTenants(tenants, query, todayIn());
  const page = paginate(filtered, query.page, query.pageSize);
  return ok({ apps, rows: page.rows, total: filtered.length, page: page.page, pageCount: page.pageCount, pageSize: query.pageSize, today: todayIn() });
}

export async function POST(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const body = await readBody(request);
  const app = findApp(typeof body.app === "string" ? body.app : "");
  if (!app) return fail("platformUnknownApp", 400);
  const input = { ...body };
  delete input.app;
  try {
    const data = await agentCall<{ tenant: TenantRecord; adminPassword: string }>(app, "/tenants", { method: "POST", body: input, timeoutMs: 5 * 60 * 1000 });
    return ok({ tenant: { ...data.tenant, app: app.key }, adminPassword: data.adminPassword }, 201);
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
