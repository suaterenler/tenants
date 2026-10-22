import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import webpush, { type PushSubscription } from "web-push";
import { adminEmail } from "./mail";
import { dataDir } from "./live-store";

type PushData = { publicKey: string; privateKey: string; subscriptions: PushSubscription[] };

let queue: Promise<unknown> = Promise.resolve();

function pushFile(): string {
  return path.join(dataDir(), "live-push.json");
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<PushData> {
  try {
    const raw = JSON.parse(await readFile(pushFile(), "utf8")) as Partial<PushData>;
    if (raw.publicKey && raw.privateKey) return { publicKey: raw.publicKey, privateKey: raw.privateKey, subscriptions: Array.isArray(raw.subscriptions) ? raw.subscriptions : [] };
  } catch {
    return save(fresh());
  }
  return save(fresh());
}

function fresh(): PushData {
  const keys = webpush.generateVAPIDKeys();
  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subscriptions: [] };
}

async function save(data: PushData): Promise<PushData> {
  const file = pushFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, file);
  return data;
}

function keys(data: PushData): { publicKey: string; privateKey: string } {
  const publicKey = process.env.LIVE_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.LIVE_VAPID_PRIVATE_KEY?.trim();
  return publicKey && privateKey ? { publicKey, privateKey } : { publicKey: data.publicKey, privateKey: data.privateKey };
}

export function pushPublicKey(): Promise<string> {
  return exclusive(async () => keys(await load()).publicKey);
}

export function isSubscription(value: unknown): value is PushSubscription {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const k = item.keys as Record<string, unknown> | undefined;
  return typeof item.endpoint === "string" && item.endpoint.startsWith("https://") && item.endpoint.length < 1000 && typeof k?.p256dh === "string" && typeof k?.auth === "string";
}

export function addSubscription(subscription: PushSubscription): Promise<void> {
  return exclusive(async () => {
    const data = await load();
    data.subscriptions = [...data.subscriptions.filter((item) => item.endpoint !== subscription.endpoint), { endpoint: subscription.endpoint, keys: subscription.keys }].slice(-20);
    await save(data);
  });
}

export function removeSubscription(endpoint: string): Promise<void> {
  return exclusive(async () => {
    const data = await load();
    data.subscriptions = data.subscriptions.filter((item) => item.endpoint !== endpoint);
    await save(data);
  });
}

export async function sendPush(payload: { title: string; body: string; url: string; tag: string }): Promise<void> {
  const data = await exclusive(load);
  if (data.subscriptions.length === 0) return;
  const vapid = keys(data);
  const gone: string[] = [];
  await Promise.all(
    data.subscriptions.map((subscription) =>
      webpush
        .sendNotification(subscription, JSON.stringify(payload), {
          TTL: 15 * 60,
          urgency: "high",
          vapidDetails: { subject: `mailto:${adminEmail()}`, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        })
        .catch((error: { statusCode?: number }) => {
          if (error.statusCode === 404 || error.statusCode === 410) gone.push(subscription.endpoint);
        }),
    ),
  );
  for (const endpoint of gone) await removeSubscription(endpoint);
}
