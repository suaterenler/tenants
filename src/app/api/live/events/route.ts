import { requireSession } from "@/server/auth";
import { adminSubscribe } from "@/server/live-hub";
import { startLiveJobs } from "@/server/live-support";
import { eventStream } from "@/server/sse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  startLiveJobs();
  return eventStream(request, (emit) => adminSubscribe(emit));
}
