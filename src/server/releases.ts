import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { AgentError, agentCall, programList } from "./apps";

export type BuildInfo = { commit: string | null; builtAt: string | null };
export type Release = { commit: string; builtAt: string | null; receivedAt: string };
export type BuildFailure = { commit: string; failedAt: string; runUrl: string | null };
export type BuildInProgress = { commit: string; startedAt: string; runUrl: string | null };
export type ProgramVersion = { key: string; name: string; running: BuildInfo | null; expected: Release | null; failed: BuildFailure | null; building: BuildInProgress | null };

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
const NO_INFO: BuildInfo = { commit: null, builtAt: null };

function releasesFile(): string {
  return path.join(process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"), "releases.json");
}

function buildingFile(): string {
  return path.join(process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"), "builds-in-progress.json");
}

const BUILDING_MAX_AGE_MS = 45 * 60 * 1000;

function failuresFile(): string {
  return path.join(process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"), "build-failures.json");
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

export async function readFailures(): Promise<Record<string, BuildFailure>> {
  try {
    const raw: unknown = JSON.parse(await readFile(failuresFile(), "utf8"));
    return raw && typeof raw === "object" ? (raw as Record<string, BuildFailure>) : {};
  } catch {
    return {};
  }
}

export async function readBuilding(): Promise<Record<string, BuildInProgress>> {
  try {
    const raw: unknown = JSON.parse(await readFile(buildingFile(), "utf8"));
    return raw && typeof raw === "object" ? (raw as Record<string, BuildInProgress>) : {};
  } catch {
    return {};
  }
}

export function parseBuilding(body: unknown): { app: string; build: BuildInProgress } | null {
  if (!body || typeof body !== "object") return null;
  const entry = body as Record<string, unknown>;
  if (entry.status !== "building") return null;
  const app = typeof entry.app === "string" ? entry.app.trim() : "";
  const commit = typeof entry.commit === "string" ? entry.commit.trim().toLowerCase() : "";
  const runUrl = typeof entry.runUrl === "string" && entry.runUrl.startsWith("https://github.com/") ? entry.runUrl : null;
  if (!releaseApps().includes(app) || !COMMIT_PATTERN.test(commit)) return null;
  return { app, build: { commit, startedAt: new Date().toISOString(), runUrl } };
}

export function parseFailure(body: unknown): { app: string; failure: BuildFailure } | null {
  if (!body || typeof body !== "object") return null;
  const entry = body as Record<string, unknown>;
  if (entry.status !== "failed") return null;
  const app = typeof entry.app === "string" ? entry.app.trim() : "";
  const commit = typeof entry.commit === "string" ? entry.commit.trim().toLowerCase() : "";
  const runUrl = typeof entry.runUrl === "string" && entry.runUrl.startsWith("https://github.com/") ? entry.runUrl : null;
  if (!releaseApps().includes(app) || !COMMIT_PATTERN.test(commit)) return null;
  return { app, failure: { commit, failedAt: new Date().toISOString(), runUrl } };
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

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

export async function recordRelease(app: string, release: Release): Promise<void> {
  await writeJson(releasesFile(), { ...(await readReleases()), [app]: release });
  await clearFailure(app);
  await clearBuilding(app);
}

export async function recordFailure(app: string, failure: BuildFailure): Promise<void> {
  await writeJson(failuresFile(), { ...(await readFailures()), [app]: failure });
  await clearBuilding(app);
}

export async function recordBuilding(app: string, build: BuildInProgress): Promise<void> {
  await writeJson(buildingFile(), { ...(await readBuilding()), [app]: build });
  await clearFailure(app);
}

async function clearBuilding(app: string): Promise<void> {
  const current = await readBuilding();
  if (!(app in current)) return;
  const { [app]: _removed, ...rest } = current;
  await writeJson(buildingFile(), rest);
}

async function clearFailure(app: string): Promise<void> {
  const current = await readFailures();
  if (!(app in current)) return;
  const { [app]: _removed, ...rest } = current;
  await writeJson(failuresFile(), rest);
}

export function sameCommit(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.toLowerCase().startsWith(short.toLowerCase());
}

const DEV = process.env.NODE_ENV === "development";

function localBuild(): BuildInfo {
  if (!DEV) return NO_INFO;
  try {
    const [commit, builtAt] = execFileSync("git", ["log", "-1", "--format=%h%n%cI"], { encoding: "utf8" }).trim().split(/\r?\n/);
    return { commit: commit || null, builtAt: builtAt || null };
  } catch {
    return NO_INFO;
  }
}

function localExpected(running: BuildInfo | null, release: Release | undefined): Release | null {
  if (release) return release;
  return DEV && running?.commit ? { commit: running.commit, builtAt: running.builtAt, receivedAt: new Date().toISOString() } : null;
}

export async function programVersions(): Promise<ProgramVersion[]> {
  const [releases, failures, buildingAll] = await Promise.all([readReleases(), readFailures(), readBuilding()]);
  const building = (key: string): BuildInProgress | null => {
    const entry = buildingAll[key];
    return entry && Date.now() - Date.parse(entry.startedAt) < BUILDING_MAX_AGE_MS ? entry : null;
  };
  const local = localBuild();
  const own: BuildInfo = { commit: process.env.APP_COMMIT?.trim() || local.commit, builtAt: process.env.APP_BUILD_DATE?.trim() || local.builtAt };
  const programs = await Promise.all(
    programList().map(async (app) => {
      const running = await agentCall<BuildInfo>(app, "/version", { timeoutMs: 5000 }).catch((error: unknown) => (error instanceof AgentError && (error.status === 404 || error.message.startsWith("HTTP ")) ? NO_INFO : null));
      return { key: app.key, name: app.name, running, expected: localExpected(running, releases[app.key]), failed: failures[app.key] ?? null, building: building(app.key) };
    }),
  );
  return [...programs, { key: "tenants", name: "Yönetim", running: own, expected: localExpected(own, releases.tenants), failed: failures.tenants ?? null, building: building("tenants") }];
}
