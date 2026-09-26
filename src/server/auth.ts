import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";
import { tr } from "@messages/tr";
import { credentialVersion } from "./credentials";

const AUDIENCE = "erenler-platform";
const RESET_AUDIENCE = "erenler-platform-reset";
const RESET_MINUTES = 10;
const TOKEN_HOURS = 8;
const DEV_SECRET = "platform-dev-secret-only-for-local-development";

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET?.trim() ?? "";
  if (process.env.NODE_ENV === "production" && value.length < 32) throw new Error("SESSION_SECRET en az 32 karakter olmalıdır.");
  return new TextEncoder().encode(value || DEV_SECRET);
}

export async function signToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ scope: "platform", ver: await credentialVersion() })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_HOURS * 60 * 60)
    .sign(secret());
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], audience: AUDIENCE });
    return payload.scope === "platform" && payload.ver === (await credentialVersion());
  } catch {
    return false;
  }
}

export async function signResetToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ scope: "reset", ver: await credentialVersion() })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(RESET_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + RESET_MINUTES * 60)
    .sign(secret());
}

export async function verifyResetToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], audience: RESET_AUDIENCE });
    return payload.scope === "reset" && payload.ver === (await credentialVersion());
  } catch {
    return false;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(code: string, status: number) {
  const message = tr.errors[code as keyof typeof tr.errors] ?? tr.errors.unexpected;
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export async function requireSession(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !(await verifyToken(token))) return fail("unauthorized", 401);
  return null;
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const attempts = new Map<string, number[]>();

export function rateLimited(request: Request, max = 5, windowMs = 10 * 60 * 1000, scope = "login"): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  const key = `${scope}:${forwarded || "direct"}`;
  const now = Date.now();
  const hits = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (hits.length >= max) {
    attempts.set(key, hits);
    return true;
  }
  hits.push(now);
  attempts.set(key, hits);
  return false;
}

export function clearRate(request: Request, scope = "login"): void {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  attempts.delete(`${scope}:${forwarded || "direct"}`);
}
