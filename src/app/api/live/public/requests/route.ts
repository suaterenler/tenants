import { rateLimited, readBody } from "@/server/auth";
import { emitAdmin, issueRequestToken } from "@/server/live-hub";
import { createSession, getSettings } from "@/server/live-store";
import { corsJson, mailIfAdminOffline, mailSession, preflight, pushSession, startLiveJobs } from "@/server/live-support";
import { cleanEmail, cleanName, cleanNote, cleanPage, cleanPhone } from "@/lib/live";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  startLiveJobs();
  if (rateLimited(request, 8, 10 * 60 * 1000, "live-request")) return corsJson(request, { error: "rateLimited" }, 429);
  const body = await readBody(request);
  const mode = body.mode === "call" ? "call" : "callback";
  const name = cleanName(body.name);
  const phone = cleanPhone(body.phone);
  const email = cleanEmail(body.email);
  if (!name) return corsJson(request, { error: "nameRequired" }, 400);
  if (mode === "callback" && !phone) return corsJson(request, { error: "phoneRequired" }, 400);
  const settings = await getSettings();
  if (mode === "call" && !settings.available) return corsJson(request, { error: "unavailable" }, 409);
  const session = await createSession({ status: mode === "call" ? "waiting" : "request", name, phone, email, note: cleanNote(body.note), page: cleanPage(body.page) });
  emitAdmin("session", session);
  if (mode === "call") {
    pushSession("waiting", session);
    mailIfAdminOffline(session);
    return corsJson(request, { id: session.id, token: issueRequestToken(session.id) }, 201);
  }
  pushSession("request", session);
  void mailSession("request", session);
  return corsJson(request, { id: session.id }, 201);
}
