import { readBody } from "@/server/auth";
import { checkRequestToken, emitAdmin } from "@/server/live-hub";
import { updateSession } from "@/server/live-store";
import { corsJson, mailSession, preflight, pushSession } from "@/server/live-support";
import { cleanName, cleanNote, cleanPhone } from "@/lib/live";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!checkRequestToken(id, request.headers.get("x-live-token") ?? "")) return corsJson(request, { error: "unauthorized" }, 401);
  const body = await readBody(request);
  const phone = cleanPhone(body.phone);
  if (!phone) return corsJson(request, { error: "phoneRequired" }, 400);
  const name = cleanName(body.name);
  const note = cleanNote(body.note);
  const session = await updateSession(id, (item) => {
    item.phone = phone;
    if (name) item.name = name;
    if (note) item.note = item.note ? `${item.note}
${note}` : note;
    if (item.status === "waiting" || item.status === "rejected") item.status = "missed";
    item.isNew = true;
  });
  if (!session) return corsJson(request, { error: "notFound" }, 404);
  emitAdmin("session", session);
  pushSession("missed", session);
  void mailSession("missed", session);
  return corsJson(request, { ok: true });
}
