import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function secretMatches(token: string, secret: string): boolean {
  return token !== "" && timingSafeEqual(digest(token), digest(secret));
}
