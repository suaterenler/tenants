import { rateLimited, readBody } from "@/server/auth";
import { emitAdmin, issueRequestToken } from "@/server/live-hub";
import { createSession, getSettings, listSessions, updateSession } from "@/server/live-store";
import { corsJson, enforceAutoOff, mailIfAdminOffline, mailSession, preflight, pushSession, startLiveJobs } from "@/server/live-support";
import { cleanEmail, cleanName, cleanNote, cleanPage, cleanPhone, LIVE_QUEUE_SECONDS } from "@/lib/live";

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
  await enforceAutoOff();
  const settings = await getSettings();
  if (mode === "call" && !settings.available) return corsJson(request, { error: "unavailable" }, 409);
  const page = cleanPage(body.page);
  const note = cleanNote(body.note);
  const recent = (await listSessions()).find((item) => item.name === name && item.page === page && Date.now() - Date.parse(item.createdAt) < LIVE_QUEUE_SECONDS * 1000 && (mode === "call" ? item.status === "waiting" : item.status === "request" && item.phone === phone));
  if (recent) {
    const updated = note ? await updateSession(recent.id, (item) => {
      item.note = item.note ? `${item.note}
${note}` : note;
      item.isNew = true;
    }) : recent;
    if (updated) emitAdmin("session", updated);
    return corsJson(request, mode === "call" ? { id: recent.id, token: issueRequestToken(recent.id) } : { id: recent.id });
  }
  const session = await createSession({ status: mode === "call" ? "waiting" : "request", name, phone, email, note, page });
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
