import "server-only";
import { createHmac } from "node:crypto";
import type { LiveSession } from "@/lib/live";
import { adminEmail, publicUrl, sendMail } from "./mail";
import { adminOnline, setMissedHandler } from "./live-hub";
import { dueReminders } from "./live-store";
import { sendPush } from "./live-push";

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export function iceServers(peerId: string): IceServer[] {
  const custom = process.env.LIVE_ICE_SERVERS?.trim();
  if (custom) {
    try {
      const parsed: unknown = JSON.parse(custom);
      if (Array.isArray(parsed)) return parsed as IceServer[];
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }
  const servers: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turnUrl = process.env.LIVE_TURN_URL?.trim();
  const turnSecret = process.env.LIVE_TURN_SECRET?.trim();
  if (turnUrl && turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 12 * 60 * 60}:${peerId}`;
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
    servers.push({ urls: turnUrl.split(",").map((url) => url.trim()), username, credential });
  }
  return servers;
}

function allowedOrigins(): string[] {
  const configured = process.env.LIVE_ORIGINS?.trim();
  const list = configured ? configured.split(",") : ["https://erenleryazilim.com", "https://www.erenleryazilim.com"];
  return list.map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const local = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!origin || (!local && !allowedOrigins().includes(origin))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Live-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function corsJson(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

const SUBJECTS: Record<string, string> = {
  request: "Canlı görüşme talebi",
  missed: "Cevapsız canlı görüşme",
  waiting: "Canlı görüşme isteği bekliyor",
  reminder: "Bugün aranacak: görüşme hatırlatması",
};

export async function mailSession(kind: "request" | "missed" | "waiting" | "reminder", session: LiveSession): Promise<void> {
  const link = `${publicUrl()}/admin/live`;
  const rows: [string, string][] = [
    ["Ad Soyad", session.name || "—"],
    ["Telefon", session.phone || "—"],
    ["E-posta", session.email || "—"],
    ["Not", session.note || "—"],
    ["Sayfa", session.page],
  ];
  if (kind === "reminder") rows.push(["Görüşme notları", session.hostNotes || "—"]);
  const subject = `${SUBJECTS[kind]}${session.name ? ` · ${session.name}` : ""}`;
  const text = `${SUBJECTS[kind]}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${link}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><h2 style="font-size:18px">${escapeHtml(SUBJECTS[kind])}</h2><table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([label, value]) => `<tr><td style="color:#666">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`)
    .join("")}</table><p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Görüşmeler</a></p></div>`;
  try {
    await sendMail({ to: adminEmail(), subject, text, html });
  } catch (error) {
    console.error("[live] mail failed", error);
  }
}

export function mailIfAdminOffline(session: LiveSession): void {
  if (!adminOnline()) void mailSession("waiting", session);
}

const PUSH_TITLES: Record<string, string> = {
  waiting: "Canlı görüşme isteği",
  request: "Canlı görüşme talebi",
  missed: "Cevapsız canlı görüşme",
  reminder: "Bugün aranacak",
};

export function pushSession(kind: "waiting" | "request" | "missed" | "reminder", session: LiveSession): void {
  const detail = [session.name || "Ziyaretçi", session.phone].filter(Boolean).join(" · ");
  void sendPush({ title: PUSH_TITLES[kind], body: kind === "waiting" ? `${detail} şu an bekliyor` : detail, url: "/admin/live", tag: `live-${kind}` }).catch((error: unknown) => console.error("[live] push failed", error));
}

const globalState = globalThis as typeof globalThis & { __erenlerLiveReminders?: ReturnType<typeof setInterval> };

function istanbulHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul" }).format(now));
}

export function startLiveJobs(): void {
  setMissedHandler((session) => {
    pushSession("missed", session);
    if (session.phone) void mailSession("missed", session);
  });
  if (globalState.__erenlerLiveReminders) return;
  const run = () => {
    const now = new Date();
    if (istanbulHour(now) < 9) return;
    void dueReminders(now).then((sessions) => {
      for (const session of sessions) {
        void mailSession("reminder", session);
        pushSession("reminder", session);
      }
    });
  };
  globalState.__erenlerLiveReminders = setInterval(run, 15 * 60 * 1000);
  run();
}
