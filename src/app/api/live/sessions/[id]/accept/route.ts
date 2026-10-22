import { fail, ok, requireSession } from "@/server/auth";
import { emitAdmin, hostInCall, notifyRequest } from "@/server/live-hub";
import { getSession, updateSession } from "@/server/live-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { id } = await context.params;
  const current = await getSession(id);
  if (!current) return fail("notFound", 404);
  if (current.status !== "waiting") return fail("liveNotWaiting", 409);
  if (hostInCall()) return fail("liveBusy", 409);
  const session = await updateSession(id, (item) => {
    item.status = "active";
    item.isNew = false;
  });
  if (!session) return fail("notFound", 404);
  notifyRequest(id, "accepted", { code: session.inviteCode });
  emitAdmin("session", session);
  return ok(session);
}
