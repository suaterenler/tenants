import { fail, ok, requireSession } from "@/server/auth";
import { emitAdmin, notifyRequest } from "@/server/live-hub";
import { updateSession } from "@/server/live-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { id } = await context.params;
  const session = await updateSession(id, (item) => {
    if (item.status === "waiting") item.status = "rejected";
    item.isNew = false;
  });
  if (!session) return fail("notFound", 404);
  notifyRequest(id, "rejected", {});
  emitAdmin("session", session);
  return ok(session);
}
