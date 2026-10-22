import { fail, ok, readBody, requireSession } from "@/server/auth";
import { addSubscription, isSubscription, pushPublicKey, removeSubscription } from "@/server/live-push";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return ok({ publicKey: await pushPublicKey() });
}

export async function POST(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!isSubscription(body.subscription)) return fail("invalidRecord", 400);
  await addSubscription(body.subscription);
  return ok({ subscribed: true });
}

export async function DELETE(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (typeof body.endpoint !== "string") return fail("invalidRecord", 400);
  await removeSubscription(body.endpoint);
  return ok({ removed: true });
}
