import { fail } from "@/server/auth";
import { attachStream, memberByToken } from "@/server/live-hub";
import { eventStream } from "@/server/sse";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const code = (await context.params).code.toUpperCase();
  const member = memberByToken(code, request.headers.get("x-peer-token") ?? "");
  if (!member) return fail("liveClosed", 410);
  return eventStream(request, (emit) => attachStream(code, member, emit));
}
