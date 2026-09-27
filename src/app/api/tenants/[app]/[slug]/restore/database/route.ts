import { AgentError, agentSend, findApp } from "@/server/apps";
import { fail, ok, requireSession } from "@/server/auth";

const MAX_BYTES = 512 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("unknownProgram", 400);
  const zip = await request.arrayBuffer();
  if (zip.byteLength === 0 || zip.byteLength > MAX_BYTES) return fail("invalidBackup", 400);
  try {
    return ok(await agentSend<{ restored: boolean }>(app, `/tenants/${encodeURIComponent(params.slug)}/restore/database`, zip));
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
