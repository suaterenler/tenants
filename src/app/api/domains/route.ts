import { createHash, timingSafeEqual } from "node:crypto";
import { domainRoutes, tenantsSecret } from "@/server/apps";
import { fail, ok } from "@/server/auth";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  let secret: string;
  try {
    secret = tenantsSecret();
  } catch {
    return fail("programUnavailable", 503);
  }
  if (!token || !timingSafeEqual(digest(token), digest(secret))) return fail("unauthorized", 401);
  return ok(await domainRoutes());
}
