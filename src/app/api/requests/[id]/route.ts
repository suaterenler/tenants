import { fail, ok, readBody, requireSession } from "@/server/auth";
import { deleteRequest, updateRequest } from "@/server/requests";
import { parsePatch } from "@/lib/requests";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const patch = parsePatch(await readBody(request));
  if (!patch) return fail("invalidRecord", 400);
  const { id } = await context.params;
  const updated = await updateRequest(id, patch, "admin");
  if (updated === "linked") return fail("requestLinked", 409);
  return updated ? ok(updated) : fail("notFound", 404);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { id } = await context.params;
  return (await deleteRequest(id)) ? ok({ deleted: true }) : fail("notFound", 404);
}
