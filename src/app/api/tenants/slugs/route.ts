import { AgentError, agentCall, findApp, type TenantRecord } from "@/server/apps";
import { fail, ok, requireSession } from "@/server/auth";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const app = findApp(new URL(request.url).searchParams.get("app") ?? "");
  if (!app) return fail("unknownProgram", 400);
  try {
    const records = await agentCall<TenantRecord[]>(app, "/tenants");
    return ok({ slugs: records.map((record) => record.slug) });
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
