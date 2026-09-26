import { AgentError, agentCall, findApp } from "@/server/apps";
import { fail, ok, requireSession } from "@/server/auth";

export async function POST(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("platformUnknownApp", 400);
  try {
    return ok(await agentCall<{ password: string }>(app, `/tenants/${encodeURIComponent(params.slug)}/reset-admin`, { method: "POST", body: {} }));
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
