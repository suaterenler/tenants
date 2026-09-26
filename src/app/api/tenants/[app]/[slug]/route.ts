import { AgentError, agentCall, findApp, type TenantRecord } from "@/server/apps";
import { fail, ok, readBody, requireSession } from "@/server/auth";

export async function PATCH(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("platformUnknownApp", 400);
  try {
    const updated = await agentCall<TenantRecord>(app, `/tenants/${encodeURIComponent(params.slug)}`, { method: "PATCH", body: await readBody(request) });
    return ok({ ...updated, app: app.key });
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("platformUnknownApp", 400);
  try {
    return ok(await agentCall<{ deleted: boolean }>(app, `/tenants/${encodeURIComponent(params.slug)}`, { method: "DELETE", timeoutMs: 2 * 60 * 1000 }));
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
