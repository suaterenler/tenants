import { createHash, timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/server/auth";
import { parseFailure, parseRelease, recordFailure, recordRelease } from "@/server/releases";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function POST(request: Request) {
  const secret = process.env.RELEASE_SECRET?.trim() ?? "";
  if (secret.length < 32) return fail("releaseNotConfigured", 503);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !timingSafeEqual(digest(token), digest(secret))) return fail("unauthorized", 401);
  const body: unknown = await request.json().catch(() => null);
  const failed = parseFailure(body);
  if (failed) {
    await recordFailure(failed.app, failed.failure);
    return ok(null);
  }
  const parsed = parseRelease(body);
  if (!parsed) return fail("invalidRecord", 400);
  await recordRelease(parsed.app, parsed.release);
  return ok(null);
}
