import { parseDomains } from "@/lib/domain";
import { AgentError, agentCall, domainConflict, findApp, type TenantRecord } from "@/server/apps";
import { fail, ok, readBody, requireSession } from "@/server/auth";

export async function PATCH(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("unknownProgram", 400);
  const body = await readBody(request);
  if ("domains" in body) {
    const { domains, invalid } = parseDomains(body.domains);
    if (invalid) return fail("tenantInvalidDomain", 400);
    body.domains = domains;
  }
  try {
    if (Array.isArray(body.domains) && (await domainConflict(body.domains as string[], app.key, params.slug))) return fail("tenantDomainTaken", 409);
    const updated = await agentCall<TenantRecord>(app, `/tenants/${encodeURIComponent(params.slug)}`, { method: "PATCH", body });
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
  if (!app) return fail("unknownProgram", 400);
  try {
    return ok(await agentCall<{ deleted: boolean }>(app, `/tenants/${encodeURIComponent(params.slug)}`, { method: "DELETE", timeoutMs: 2 * 60 * 1000 }));
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
