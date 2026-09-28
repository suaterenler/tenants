import { ok, requireSession } from "@/server/auth";
import { programVersions } from "@/server/releases";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok(await programVersions());
}
