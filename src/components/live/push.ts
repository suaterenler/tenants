import { BASE_PATH, adminFetch } from "@/lib/admin-client";

function keyBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

export async function enablePush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.register(`${BASE_PATH}/live-sw.js`, { scope: `${BASE_PATH}/` });
    await navigator.serviceWorker.ready;
    const { publicKey } = await adminFetch<{ publicKey: string }>("/live/push");
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const current = subscription.options.applicationServerKey;
      const expected = keyBytes(publicKey);
      const same = current !== null && new Uint8Array(current).every((byte, index) => byte === expected[index]);
      if (!same) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    await adminFetch("/live/push", { method: "POST", body: { subscription: subscription.toJSON() } });
    return true;
  } catch {
    return false;
  }
}
