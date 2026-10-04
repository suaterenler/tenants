import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { sameSubmission, tenantLinkAllowed, withDefaults, type InboundRequest, type RequestPatch, type TrialRequest } from "@/lib/requests";

let queue: Promise<unknown> = Promise.resolve();

function requestsFile(): string {
  return path.join(process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"), "requests.json");
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<TrialRequest[]> {
  try {
    const raw: unknown = JSON.parse(await readFile(requestsFile(), "utf8"));
    return Array.isArray(raw) ? (raw as TrialRequest[]).map(withDefaults) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: TrialRequest[]): Promise<void> {
  const file = requestsFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

export async function listRequests(): Promise<TrialRequest[]> {
  await queue;
  return (await readAll()).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function countNewRequests(): Promise<number> {
  return (await listRequests()).filter((item) => item.status === "new").length;
}

export function addRequest(input: InboundRequest): Promise<{ id: string; duplicate: boolean }> {
  return exclusive(async () => {
    const items = await readAll();
    const existing = items.find((item) => sameSubmission(item, input));
    if (existing) return { id: existing.id, duplicate: true };
    const now = new Date().toISOString();
    const record: TrialRequest = { ...input, id: randomUUID(), receivedAt: now, status: "new", note: "", updatedAt: now, updatedBy: "" };
    items.push(record);
    await writeAll(items);
    return { id: record.id, duplicate: false };
  });
}

export function updateRequest(id: string, patch: RequestPatch, by: string): Promise<TrialRequest | "linked" | null> {
  return exclusive(async () => {
    const items = await readAll();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    if (!tenantLinkAllowed(items[index], patch)) return "linked";
    const next: TrialRequest = { ...items[index], ...patch, updatedAt: new Date().toISOString(), updatedBy: by };
    items[index] = next;
    await writeAll(items);
    return next;
  });
}

export function deleteRequest(id: string): Promise<boolean> {
  return exclusive(async () => {
    const items = await readAll();
    const rest = items.filter((item) => item.id !== id);
    if (rest.length === items.length) return false;
    await writeAll(rest);
    return true;
  });
}
