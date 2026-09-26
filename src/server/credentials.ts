import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 10;

type Stored = { passwordHash: string; version: number };

function dataFile(): string {
  return path.join(process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"), "admin.json");
}

async function readStored(): Promise<Stored | null> {
  try {
    const raw: unknown = JSON.parse(await readFile(dataFile(), "utf8"));
    if (raw === null || typeof raw !== "object") return null;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.passwordHash !== "string" || typeof entry.version !== "number") return null;
    return { passwordHash: entry.passwordHash, version: entry.version };
  } catch {
    return null;
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function credentialVersion(): Promise<number> {
  return (await readStored())?.version ?? 0;
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  const stored = await readStored();
  if (stored) return bcrypt.compare(candidate, stored.passwordHash);
  const fallback = (process.env.TENANTS_PASSWORD ?? process.env.PLATFORM_PASSWORD)?.trim();
  return fallback ? timingSafeEqual(digest(candidate), digest(fallback)) : false;
}

export async function setPassword(password: string): Promise<number> {
  const version = (await credentialVersion()) + 1;
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify({ passwordHash: await bcrypt.hash(password, 12), version }), { mode: 0o600 });
  await rename(temp, file);
  return version;
}
