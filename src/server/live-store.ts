import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyAppearance, inviteCode, parseAppearance, type LiveMessage, type LiveParticipant, type LiveSession, type LiveSessionPatch, type LiveSettings } from "@/lib/live";

type LiveData = { settings: LiveSettings; sessions: LiveSession[] };

function defaultSettings(): LiveSettings {
  return { available: false, approveJoin: true, guestShare: true, hostName: "Erenler Yazılım", visibility: "always", appearance: emptyAppearance() };
}

let queue: Promise<unknown> = Promise.resolve();

export function dataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

function liveFile(): string {
  return path.join(dataDir(), "live.json");
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function withDefaults(session: Partial<LiveSession> & { id: string }): LiveSession {
  return {
    status: "request",
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    name: "",
    phone: "",
    email: "",
    note: "",
    inviteCode: "",
    participants: [],
    messages: [],
    hostNotes: "",
    reminderAt: null,
    reminderDone: false,
    reminderMailedAt: null,
    isNew: false,
    page: "/",
    ...session,
  };
}

async function readData(): Promise<LiveData> {
  try {
    const raw = JSON.parse(await readFile(liveFile(), "utf8")) as Partial<LiveData>;
    return {
      settings: { ...defaultSettings(), ...(raw.settings ?? {}), appearance: parseAppearance(raw.settings?.appearance) ?? emptyAppearance() },
      sessions: Array.isArray(raw.sessions) ? raw.sessions.map(withDefaults) : [],
    };
  } catch {
    return { settings: defaultSettings(), sessions: [] };
  }
}

async function writeData(data: LiveData): Promise<void> {
  const file = liveFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

function mutate<T>(task: (data: LiveData) => T): Promise<T> {
  return exclusive(async () => {
    const data = await readData();
    const result = task(data);
    await writeData(data);
    return result;
  });
}

export async function getSettings(): Promise<LiveSettings> {
  await queue;
  return (await readData()).settings;
}

export function updateSettings(patch: Partial<LiveSettings>): Promise<LiveSettings> {
  return mutate((data) => {
    data.settings = { ...data.settings, ...patch };
    return data.settings;
  });
}

export async function listSessions(): Promise<LiveSession[]> {
  await queue;
  return (await readData()).sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSession(id: string): Promise<LiveSession | null> {
  await queue;
  return (await readData()).sessions.find((session) => session.id === id) ?? null;
}

export async function findByCode(code: string): Promise<LiveSession | null> {
  await queue;
  return (await readData()).sessions.find((session) => session.inviteCode === code) ?? null;
}

function uniqueCode(sessions: LiveSession[]): string {
  const used = new Set(sessions.map((session) => session.inviteCode));
  let code = inviteCode(() => randomInt(0, 1_000_000) / 1_000_000);
  while (used.has(code)) code = inviteCode(() => randomInt(0, 1_000_000) / 1_000_000);
  return code;
}

export function createSession(input: Pick<LiveSession, "status" | "name" | "phone" | "email" | "note" | "page">): Promise<LiveSession> {
  return mutate((data) => {
    const session = withDefaults({
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      inviteCode: input.status === "waiting" ? uniqueCode(data.sessions) : "",
      isNew: true,
    });
    data.sessions.push(session);
    return session;
  });
}

export function updateSession(id: string, change: (session: LiveSession, data: LiveData) => void): Promise<LiveSession | null> {
  return mutate((data) => {
    const session = data.sessions.find((item) => item.id === id);
    if (!session) return null;
    change(session, data);
    return { ...session };
  });
}

export function patchSession(id: string, patch: LiveSessionPatch): Promise<LiveSession | null> {
  return updateSession(id, (session) => {
    Object.assign(session, patch);
    if (patch.reminderAt !== undefined) session.reminderMailedAt = null;
  });
}

export function ensureCode(id: string): Promise<LiveSession | null> {
  return updateSession(id, (session, data) => {
    if (!session.inviteCode) session.inviteCode = uniqueCode(data.sessions);
  });
}

export function deleteSession(id: string): Promise<boolean> {
  return mutate((data) => {
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((session) => session.id !== id);
    return data.sessions.length !== before;
  });
}

export function addParticipant(id: string, participant: LiveParticipant): Promise<number> {
  return mutate((data) => {
    const session = data.sessions.find((item) => item.id === id);
    if (!session) return -1;
    session.participants.push(participant);
    return session.participants.length - 1;
  });
}

export function closeParticipant(id: string, index: number): Promise<void> {
  return mutate((data) => {
    const session = data.sessions.find((item) => item.id === id);
    const participant = session?.participants[index];
    if (participant && !participant.leftAt) participant.leftAt = new Date().toISOString();
  });
}

export function appendMessage(id: string, message: Omit<LiveMessage, "id" | "at">): Promise<LiveMessage | null> {
  return mutate((data) => {
    const session = data.sessions.find((item) => item.id === id);
    if (!session) return null;
    const entry: LiveMessage = { ...message, id: randomUUID(), at: new Date().toISOString() };
    session.messages.push(entry);
    return entry;
  });
}

export function expireWaiting(olderThanMs: number): Promise<LiveSession[]> {
  return mutate((data) => {
    const limit = Date.now() - olderThanMs;
    const expired: LiveSession[] = [];
    for (const session of data.sessions) {
      if (session.status === "waiting" && new Date(session.createdAt).getTime() < limit) {
        session.status = "missed";
        session.isNew = true;
        expired.push({ ...session });
      }
    }
    return expired;
  });
}

export function dueReminders(now: Date): Promise<LiveSession[]> {
  return mutate((data) => {
    const today = now.toISOString().slice(0, 10);
    const due: LiveSession[] = [];
    for (const session of data.sessions) {
      if (!session.reminderAt || session.reminderDone) continue;
      if (session.reminderMailedAt?.slice(0, 10) === today) continue;
      if (session.reminderAt.slice(0, 10) > today) continue;
      session.reminderMailedAt = now.toISOString();
      due.push({ ...session });
    }
    return due;
  });
}
