import { fail, ok, readBody, requireSession } from "@/server/auth";
import { emitAdmin, hostInCall } from "@/server/live-hub";
import { getSettings, updateSettings } from "@/server/live-store";
import { cleanName, LIVE_VISIBILITIES, parseAppearance, type LiveSettings, type LiveVisibility } from "@/lib/live";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok({ ...(await getSettings()), busy: hostInCall() });
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
  if (body.visibility !== undefined) {
    if (typeof body.visibility !== "string" || !LIVE_VISIBILITIES.includes(body.visibility as LiveVisibility)) return fail("invalidRecord", 400);
    patch.visibility = body.visibility as LiveVisibility;
  }
  if (body.appearance !== undefined) {
    const appearance = parseAppearance(body.appearance);
    if (!appearance) return fail("invalidRecord", 400);
    patch.appearance = appearance;
  }
  const settings = await updateSettings(patch);
  emitAdmin("settings", settings);
  return ok(settings);
}
