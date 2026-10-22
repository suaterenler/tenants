import { fail, ok, requireSession } from "@/server/auth";
import { ensureCode, updateSession } from "@/server/live-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { id } = await context.params;
  const withCode = await ensureCode(id);
  if (!withCode) return fail("notFound", 404);
  const session = await updateSession(id, (item) => {
    item.isNew = false;
    if (item.status !== "active") {
      item.status = "active";
      item.endedAt = null;
    }
  });
  return ok(session);
}
