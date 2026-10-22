import { checkRequestToken, requestSubscribe } from "@/server/live-hub";
import { getSession } from "@/server/live-store";
import { corsHeaders, corsJson, preflight } from "@/server/live-support";
import { eventStream } from "@/server/sse";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!checkRequestToken(id, request.headers.get("x-live-token") ?? "")) return corsJson(request, { error: "unauthorized" }, 401);
  const session = await getSession(id);
  if (!session) return corsJson(request, { error: "notFound" }, 404);
  return eventStream(
    request,
    (emit) => {
      if (session.status === "active") emit("accepted", { code: session.inviteCode });
      else if (session.status === "rejected") emit("rejected", {});
      else if (session.status === "missed") emit("missed", {});
      return requestSubscribe(id, emit);
    },
    corsHeaders(request),
  );
}
