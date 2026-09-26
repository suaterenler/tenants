import { clearRate, fail, ok, rateLimited, readBody, verifyResetToken } from "@/server/auth";
import { MIN_PASSWORD_LENGTH, setPassword } from "@/server/credentials";

export async function POST(request: Request) {
  if (rateLimited(request, 10, 15 * 60 * 1000, "reset")) return fail("rateLimited", 429);
  const body = await readBody(request);
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || !(await verifyResetToken(token))) return fail("resetInvalid", 400);
  if (password.trim().length < MIN_PASSWORD_LENGTH) return fail("passwordTooShort", 400);
  await setPassword(password);
  clearRate(request);
  clearRate(request, "reset");
  return ok({ changed: true });
}
