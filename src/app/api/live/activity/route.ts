import { fail, ok } from "@/server/auth";
import { openRoomCount } from "@/server/live-hub";
import { listSessions } from "@/server/live-store";
import { secretMatches } from "@/server/secret";
import { bearerToken, resolveRequestsSecret } from "@/lib/requests";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = resolveRequestsSecret(process.env);
  if (!secret || !secretMatches(bearerToken(request.headers.get("authorization")), secret)) return fail("unauthorized", 401);
  const waiting = (await listSessions()).filter((session) => session.status === "waiting").length;
  return ok({ rooms: openRoomCount(), waiting });
}
