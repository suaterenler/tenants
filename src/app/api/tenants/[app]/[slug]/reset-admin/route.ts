import { AgentError, agentCall, findApp } from "@/server/apps";
import { fail, ok, requireSession } from "@/server/auth";
import { checkOptionalPassword, isValidUsername } from "@/lib/password";

export async function POST(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("unknownProgram", 400);
  const body: unknown = await request.json().catch(() => null);
  const requested = typeof body === "object" && body !== null ? (body as Record<string, unknown>).password : undefined;
  if (requested !== undefined && requested !== null && typeof requested !== "string") return fail("invalidPassword", 400);
  const rawName = typeof body === "object" && body !== null ? (body as Record<string, unknown>).username : undefined;
  if (rawName !== undefined && rawName !== null && typeof rawName !== "string") return fail("invalidUsername", 400);
  const username = rawName ?? "";
  if (username !== "" && !isValidUsername(username)) return fail("invalidUsername", 400);
  const password = requested ?? "";
  const check = checkOptionalPassword(password);
  if (check !== "ok" && check !== "empty") return fail("invalidPassword", 400);
  try {
    return ok(await agentCall<{ username: string; password: string }>(app, `/tenants/${encodeURIComponent(params.slug)}/reset-admin`, { method: "POST", body: { ...(check === "ok" ? { password } : {}), ...(username ? { username } : {}) } }));
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
