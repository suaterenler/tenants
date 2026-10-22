import { ok, requireSession } from "@/server/auth";
import { listSessions } from "@/server/live-store";
import { liveBadgeCount } from "@/lib/live";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok({ count: liveBadgeCount(await listSessions()) });
}
