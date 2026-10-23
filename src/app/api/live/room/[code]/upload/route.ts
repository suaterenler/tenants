import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "@/server/auth";
import { memberByToken, sessionIdOf } from "@/server/live-hub";
import { dataDir } from "@/server/live-store";
import { isAllowedFile, LIVE_MAX_FILE_BYTES } from "@/lib/live";

function safeName(name: string): string {
  const base = path.basename(name).replace(/[^\p{L}\p{N}._ -]/gu, "_").trim();
  return (base || "dosya").slice(0, 120);
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const code = (await context.params).code.toUpperCase();
  const member = memberByToken(code, request.headers.get("x-peer-token") ?? "");
  const sessionId = sessionIdOf(code);
  if (!member || !member.admitted || !sessionId) return fail("liveClosed", 410);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("invalidRecord", 400);
  if (file.size > LIVE_MAX_FILE_BYTES) return fail("liveFileTooLarge", 413);
  const name = safeName(file.name);
  if (!isAllowedFile(name)) return fail("liveFileType", 415);
  const stored = `${randomUUID()}${path.extname(name).toLowerCase().slice(0, 10)}`;
  const folder = path.join(dataDir(), "live-files", sessionId);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, stored), Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
  await writeFile(path.join(folder, `${stored}.name`), name, { mode: 0o600 });
  return ok({ name, size: file.size, url: `/admin/api/live/files/${sessionId}/${stored}` });
}
