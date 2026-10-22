import { ok, requireSession } from "@/server/auth";
import { listSessions } from "@/server/live-store";
import { startLiveJobs } from "@/server/live-support";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  startLiveJobs();
  return ok(await listSessions());
}
