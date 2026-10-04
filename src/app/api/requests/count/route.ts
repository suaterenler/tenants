import { ok, requireSession } from "@/server/auth";
import { countNewRequests } from "@/server/requests";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok({ count: await countNewRequests() });
}
