import { rm } from "node:fs/promises";
import path from "node:path";
import { fail, ok, readBody, requireSession } from "@/server/auth";
import { closeRoomByCode, emitAdmin } from "@/server/live-hub";
import { dataDir, deleteSession, getSession, patchSession } from "@/server/live-store";
import { parseSessionPatch } from "@/lib/live";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const patch = parseSessionPatch(await readBody(request));
  if (!patch) return fail("invalidRecord", 400);
  const { id } = await context.params;
  const updated = await patchSession(id, patch);
  return updated ? ok(updated) : fail("notFound", 404);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { id } = await context.params;
  const session = await getSession(id);
  if (!session) return fail("notFound", 404);
  if (session.inviteCode) await closeRoomByCode(session.inviteCode);
  await deleteSession(id);
  emitAdmin("removed", { id });
  if (/^[0-9a-f-]{36}$/.test(id)) await rm(path.join(dataDir(), "live-files", id), { recursive: true, force: true });
  return ok({ deleted: true });
}
