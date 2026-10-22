import { fail, ok, readBody, requireSession } from "@/server/auth";
import { emitAdmin } from "@/server/live-hub";
import { getSettings, updateSettings } from "@/server/live-store";
import { cleanName, type LiveSettings } from "@/lib/live";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok(await getSettings());
}

export async function PUT(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const body = await readBody(request);
  const patch: Partial<LiveSettings> = {};
  for (const key of ["available", "approveJoin", "guestShare"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }
  if (typeof body.hostName === "string") {
    const hostName = cleanName(body.hostName);
    if (!hostName) return fail("liveNameRequired", 400);
    patch.hostName = hostName;
  }
  const settings = await updateSettings(patch);
  emitAdmin("settings", settings);
  return ok(settings);
}
