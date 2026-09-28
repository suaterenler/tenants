import { createHash, timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/server/auth";
import { parseRelease, recordRelease } from "@/server/releases";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function POST(request: Request) {
  const secret = process.env.RELEASE_SECRET?.trim() ?? "";
  if (secret.length < 32) return fail("releaseNotConfigured", 503);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !timingSafeEqual(digest(token), digest(secret))) return fail("unauthorized", 401);
  const parsed = parseRelease(await request.json().catch(() => null));
  if (!parsed) return fail("invalidRecord", 400);
  await recordRelease(parsed.app, parsed.release);
  return ok(null);
}
