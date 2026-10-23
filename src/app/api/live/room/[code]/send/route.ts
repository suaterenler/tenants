import { fail, ok, readBody } from "@/server/auth";
import { command, memberByToken, type RoomCommand } from "@/server/live-hub";
import { cleanMessage, cleanName } from "@/lib/live";

function parse(body: Record<string, unknown>): RoomCommand | null {
  switch (body.kind) {
    case "signal":
      return typeof body.to === "string" && body.data !== undefined ? { kind: "signal", to: body.to, data: body.data } : null;
    case "state":
      return { kind: "state", muted: body.muted === true, camera: body.camera !== false };
    case "share":
      return { kind: "share", on: body.on === true };
    case "admit":
      return typeof body.peerId === "string" ? { kind: "admit", peerId: body.peerId, allow: body.allow === true } : null;
    case "settings":
      return {
        kind: "settings",
        approveJoin: typeof body.approveJoin === "boolean" ? body.approveJoin : undefined,
        guestShare: typeof body.guestShare === "boolean" ? body.guestShare : undefined,
      };
    case "chat": {
      const text = cleanMessage(body.text);
      const file = body.file !== null && typeof body.file === "object" ? (body.file as Record<string, unknown>) : null;
      const attachment =
        file && typeof file.name === "string" && typeof file.url === "string" && typeof file.size === "number" && file.url.startsWith("/admin/api/live/files/")
          ? { name: file.name.slice(0, 200), url: file.url, size: file.size }
          : undefined;
      return text || attachment ? { kind: "chat", text, file: attachment } : null;
    }
    case "rename": {
      const name = cleanName(body.name);
      return name ? { kind: "rename", name } : null;
    }
    case "kick":
      return typeof body.peerId === "string" ? { kind: "kick", peerId: body.peerId } : null;
    case "leave":
      return { kind: "leave" };
    case "end":
      return { kind: "end" };
    case "stats":
      return { kind: "stats", data: JSON.stringify({ role: body.role, rows: body.rows }).slice(0, 4000) };
    default:
      return null;
  }
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const code = (await context.params).code.toUpperCase();
  const member = memberByToken(code, request.headers.get("x-peer-token") ?? "");
  if (!member) return fail("liveClosed", 410);
  const input = parse(await readBody(request));
  if (!input) return fail("invalidRecord", 400);
  const result = await command(code, member, input);
  if (!result.ok) return fail(result.error ?? "unexpected", result.error === "forbidden" ? 403 : 404);
  return ok({ done: true });
}
