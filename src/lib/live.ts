export type LiveStatus = "waiting" | "request" | "active" | "completed" | "missed" | "rejected";

export const LIVE_STATUSES: LiveStatus[] = ["waiting", "request", "active", "completed", "missed", "rejected"];

export type LiveRole = "host" | "guest";

export type LiveParticipant = { name: string; role: LiveRole; joinedAt: string; leftAt: string | null; inviteCode: string };

export type LiveMessage = { id: string; author: string; role: LiveRole; text: string; at: string; file?: { name: string; url: string; size: number } };

export type LiveSession = {
  id: string;
  status: LiveStatus;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  name: string;
  phone: string;
  email: string;
  note: string;
  inviteCode: string;
  participants: LiveParticipant[];
  messages: LiveMessage[];
  hostNotes: string;
  reminderAt: string | null;
  reminderDone: boolean;
  reminderMailedAt: string | null;
  isNew: boolean;
  page: string;
};

export type LiveSettings = { available: boolean; approveJoin: boolean; guestShare: boolean; hostName: string };

export type LiveSessionPatch = Partial<Pick<LiveSession, "name" | "phone" | "email" | "hostNotes" | "reminderAt" | "reminderDone" | "isNew">>;

export const LIVE_WAIT_SECONDS = 60;
export const LIVE_ROOM_IDLE_HOURS = 2;
export const LIVE_MAX_FILE_BYTES = 10 * 1024 * 1024;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
}

export function cleanName(value: unknown): string {
  return text(value, 60);
}

export function cleanPhone(value: unknown): string {
  const raw = text(value, 32);
  return /^[+\d][\d\s()-]{6,30}$/.test(raw) ? raw : "";
}

export function cleanEmail(value: unknown): string {
  const raw = text(value, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "";
}

export function cleanNote(value: unknown): string {
  return text(value, 1000);
}

export function cleanPage(value: unknown): string {
  const raw = text(value, 300);
  return raw.startsWith("/") ? raw : "/";
}

export function cleanMessage(value: unknown): string {
  return text(value, 2000);
}

export function parseSessionPatch(body: Record<string, unknown>): LiveSessionPatch | null {
  const patch: LiveSessionPatch = {};
  if ("name" in body) {
    patch.name = cleanName(body.name);
    if (!patch.name) return null;
  }
  if ("phone" in body) {
    const phone = text(body.phone, 32);
    if (phone && !cleanPhone(phone)) return null;
    patch.phone = phone;
  }
  if ("email" in body) {
    const email = text(body.email, 120);
    if (email && !cleanEmail(email)) return null;
    patch.email = email.toLowerCase();
  }
  if ("hostNotes" in body) patch.hostNotes = text(body.hostNotes, 8000);
  if ("reminderAt" in body) {
    if (body.reminderAt === null || body.reminderAt === "") patch.reminderAt = null;
    else if (typeof body.reminderAt === "string" && !Number.isNaN(Date.parse(body.reminderAt))) patch.reminderAt = new Date(body.reminderAt).toISOString();
    else return null;
  }
  if ("reminderDone" in body) {
    if (typeof body.reminderDone !== "boolean") return null;
    patch.reminderDone = body.reminderDone;
  }
  if ("isNew" in body) {
    if (typeof body.isNew !== "boolean") return null;
    patch.isNew = body.isNew;
  }
  return patch;
}

export function liveBadgeCount(sessions: LiveSession[]): number {
  return sessions.filter((session) => session.status === "waiting" || (session.isNew && (session.status === "request" || session.status === "missed"))).length;
}

export function durationMinutes(session: LiveSession): number | null {
  if (!session.startedAt || !session.endedAt) return null;
  return Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000));
}

export function isReminderDue(session: LiveSession, now: Date = new Date()): boolean {
  if (!session.reminderAt || session.reminderDone) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return new Date(session.reminderAt).getTime() <= end.getTime();
}

export function previousSessions(sessions: LiveSession[], session: LiveSession): LiveSession[] {
  const phone = session.phone.replace(/\D/g, "");
  const email = session.email.trim().toLowerCase();
  if (!phone && !email) return [];
  return sessions.filter((other) => other.id !== session.id && ((phone && other.phone.replace(/\D/g, "") === phone) || (email && other.email.trim().toLowerCase() === email)));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toLocaleUpperCase("tr");
}

export function inviteCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) code += alphabet[Math.floor(random() * alphabet.length)];
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function isInviteCode(value: string): boolean {
  return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(value);
}
