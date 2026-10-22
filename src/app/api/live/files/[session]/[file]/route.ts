import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail } from "@/server/auth";
import { dataDir } from "@/server/live-store";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(_request: Request, context: { params: Promise<{ session: string; file: string }> }) {
  const { session, file } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(session) || !/^[0-9a-f-]{36}(\.[a-z0-9]{1,9})?$/.test(file)) return fail("notFound", 404);
  const folder = path.join(dataDir(), "live-files", session);
  try {
    const data = await readFile(path.join(folder, file));
    const name = await readFile(path.join(folder, `${file}.name`), "utf8").catch(() => file);
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    const inline = type.startsWith("image/") || type === "application/pdf";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail("notFound", 404);
  }
}
