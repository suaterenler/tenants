import { fail, ok, readBody, requireSession } from "@/server/auth";
import { checkRequestToken, hostInCall, joinRoom } from "@/server/live-hub";
import { findByCode, getSettings } from "@/server/live-store";
import { iceServers, startLiveJobs } from "@/server/live-support";
import { cleanName, isInviteCode } from "@/lib/live";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  startLiveJobs();
  const code = (await context.params).code.toUpperCase();
  if (!isInviteCode(code)) return fail("notFound", 404);
  const session = await findByCode(code);
  if (!session) return fail("notFound", 404);
  const body = await readBody(request);
  const asHost = body.role === "host";
  if (asHost) {
    const denied = await requireSession(request);
    if (denied) return denied;
    if (hostInCall(code)) return fail("liveBusy", 409);
  } else {
    if (session.status !== "active") return fail("liveClosed", 410);
  }
  const trusted = !asHost && typeof body.token === "string" && checkRequestToken(session.id, body.token);
  const name = asHost ? cleanName(body.name) || (await getSettings()).hostName : cleanName(body.name) || (trusted ? session.name : "");
  if (!name) return fail("liveNameRequired", 400);
  const result = await joinRoom(session, { name, role: asHost ? "host" : "guest", trusted, pass: typeof body.pass === "string" ? body.pass : undefined });
  return ok({
    peerId: result.member.peerId,
    peerToken: result.member.token,
    pending: result.pending,
    snapshot: result.snapshot,
    iceServers: iceServers(result.member.peerId),
  });
}
