import { checkRequestToken, emitAdmin } from "@/server/live-hub";
import { updateSession } from "@/server/live-store";
import { corsJson, preflight } from "@/server/live-support";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!checkRequestToken(id, request.headers.get("x-live-token") ?? "")) return corsJson(request, { error: "unauthorized" }, 401);
  const session = await updateSession(id, (item) => {
    if (item.status === "waiting") item.status = "missed";
  });
  if (!session) return corsJson(request, { error: "notFound" }, 404);
  emitAdmin("session", session);
  return corsJson(request, { ok: true });
}
