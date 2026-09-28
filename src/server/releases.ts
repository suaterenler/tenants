import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AgentError, agentCall, programList } from "./apps";

export type BuildInfo = { commit: string | null; builtAt: string | null };
export type Release = { commit: string; builtAt: string | null; receivedAt: string };
export type ProgramVersion = { key: string; name: string; running: BuildInfo | null; expected: Release | null };

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
const NO_INFO: BuildInfo = { commit: null, builtAt: null };

function releasesFile(): string {
  return path.join(process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"), "releases.json");
}

export function releaseApps(): string[] {
  return [...programList().map((app) => app.key), "tenants"];
}

export async function readReleases(): Promise<Record<string, Release>> {
  try {
    const raw: unknown = JSON.parse(await readFile(releasesFile(), "utf8"));
    return raw && typeof raw === "object" ? (raw as Record<string, Release>) : {};
  } catch {
    return {};
  }
}

export function parseRelease(body: unknown): { app: string; release: Release } | null {
  if (!body || typeof body !== "object") return null;
  const entry = body as Record<string, unknown>;
  const app = typeof entry.app === "string" ? entry.app.trim() : "";
  const commit = typeof entry.commit === "string" ? entry.commit.trim().toLowerCase() : "";
  const builtAt = typeof entry.builtAt === "string" && !Number.isNaN(Date.parse(entry.builtAt)) ? entry.builtAt : null;
  if (!releaseApps().includes(app) || !COMMIT_PATTERN.test(commit)) return null;
  return { app, release: { commit, builtAt, receivedAt: new Date().toISOString() } };
}

export async function recordRelease(app: string, release: Release): Promise<void> {
  const file = releasesFile();
  const next = { ...(await readReleases()), [app]: release };
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

export function sameCommit(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.toLowerCase().startsWith(short.toLowerCase());
}

export async function programVersions(): Promise<ProgramVersion[]> {
  const releases = await readReleases();
  const own: BuildInfo = { commit: process.env.APP_COMMIT?.trim() || null, builtAt: process.env.APP_BUILD_DATE?.trim() || null };
  const programs = await Promise.all(
    programList().map(async (app) => ({
      key: app.key,
      name: app.name,
      running: await agentCall<BuildInfo>(app, "/version", { timeoutMs: 5000 }).catch((error: unknown) => (error instanceof AgentError && (error.status === 404 || error.message.startsWith("HTTP ")) ? NO_INFO : null)),
      expected: releases[app.key] ?? null,
    })),
  );
  return [...programs, { key: "tenants", name: "Yönetim", running: own, expected: releases.tenants ?? null }];
}
