import { AgentError, agentStream, findApp } from "@/server/apps";
import { fail, requireSession } from "@/server/auth";

const KINDS = new Set(["database", "files"]);

export async function GET(request: Request, context: { params: Promise<{ app: string; slug: string; kind: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("unknownProgram", 400);
  if (!KINDS.has(params.kind)) return fail("notFound", 404);
  try {
    const upstream = await agentStream(app, `/tenants/${encodeURIComponent(params.slug)}/backup/${params.kind}`);
    if (!upstream.ok || !upstream.body) {
      const payload = (await upstream.json().catch(() => null)) as { code?: string } | null;
      const code = (payload?.code ?? "programUnavailable").replace(/^errors\./, "");
      return fail(code === "backupUnavailable" ? "backupUnavailable" : code, upstream.status || 502);
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="${params.app}_${params.slug}-${params.kind}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
}
