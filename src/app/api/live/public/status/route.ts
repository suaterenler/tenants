import { getSettings } from "@/server/live-store";
import { corsJson, preflight, startLiveJobs } from "@/server/live-support";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  startLiveJobs();
  const settings = await getSettings();
  return corsJson(request, { available: settings.available });
}
