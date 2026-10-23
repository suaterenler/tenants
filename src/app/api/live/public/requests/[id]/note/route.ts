import { readBody } from "@/server/auth";
import { checkRequestToken, emitAdmin } from "@/server/live-hub";
import { updateSession } from "@/server/live-store";
import { corsJson, preflight } from "@/server/live-support";
import { cleanName, cleanNote, cleanPhone } from "@/lib/live";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!checkRequestToken(id, request.headers.get("x-live-token") ?? "")) return corsJson(request, { error: "unauthorized" }, 401);
  const body = await readBody(request);
  const note = cleanNote(body.note);
  const phone = cleanPhone(body.phone);
  const name = cleanName(body.name);
  if (!note && !phone) return corsJson(request, { error: "noteRequired" }, 400);
  const session = await updateSession(id, (item) => {
    if (note) item.note = item.note ? `${item.note}\n${note}` : note;
    if (phone) item.phone = phone;
    if (name) item.name = name;
    item.isNew = true;
  });
  if (!session) return corsJson(request, { error: "notFound" }, 404);
  emitAdmin("session", session);
  return corsJson(request, { ok: true });
}
