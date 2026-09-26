import { AgentError, agentCall, findApp, overview, type TenantRecord } from "@/server/apps";
import { fail, ok, readBody, requireSession } from "@/server/auth";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok(await overview());
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
