import { fail } from "@/server/auth";
import { addRequest } from "@/server/requests";
import { bearerToken, MAX_BODY_BYTES, parseInbound, resolveRequestsSecret, secretMatches } from "@/lib/requests";

export async function POST(request: Request) {
  const secret = resolveRequestsSecret(process.env);
  if (!secret) return fail("requestsNotConfigured", 503);
  if (!secretMatches(bearerToken(request.headers.get("authorization")), secret)) return fail("unauthorized", 401);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return fail("invalidRecord", 400);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("invalidRecord", 400);
  }
  const parsed = parseInbound(body);
  if (!parsed) return fail("invalidRecord", 400);
  const result = await addRequest(parsed);
  return result.duplicate ? Response.json({ id: result.id, duplicate: true }, { status: 200 }) : Response.json({ id: result.id }, { status: 201 });
}
