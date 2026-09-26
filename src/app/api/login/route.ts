import { clearRate, fail, ok, rateLimited, readBody, signToken } from "@/server/auth";
import { verifyPassword } from "@/server/credentials";

export async function POST(request: Request) {
  if (rateLimited(request)) return fail("rateLimited", 429);
  const body = await readBody(request);
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || !(await verifyPassword(password))) return fail("platformInvalidPassword", 401);
  clearRate(request);
  return ok({ token: await signToken() });
}
