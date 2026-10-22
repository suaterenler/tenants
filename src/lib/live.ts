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

export type LiveVisibility = "always" | "available" | "hidden";

export const LIVE_VISIBILITIES: LiveVisibility[] = ["always", "available", "hidden"];

export type LiveTexts = { title: string; subOn: string; subOff: string; startNow: string; requestCall: string };

export const LIVE_TEXT_KEYS: (keyof LiveTexts)[] = ["title", "subOn", "subOff", "startNow", "requestCall"];

export type LiveTheme = "auto" | "light" | "dark";

export const LIVE_THEMES: LiveTheme[] = ["auto", "light", "dark"];

export type LiveAppearance = { color: string; buttonColor: string; colorDark: string; buttonColorDark: string; theme: LiveTheme; tr: LiveTexts; en: LiveTexts };

export type LiveSettings = { available: boolean; approveJoin: boolean; guestShare: boolean; hostName: string; visibility: LiveVisibility; appearance: LiveAppearance };

export function emptyTexts(): LiveTexts {
  return { title: "", subOn: "", subOff: "", startNow: "", requestCall: "" };
}

export function emptyAppearance(): LiveAppearance {
  return { color: "", buttonColor: "", colorDark: "", buttonColorDark: "", theme: "auto", tr: emptyTexts(), en: emptyTexts() };
}

export function cleanColor(value: unknown): string | null {
  if (value === "" || value === null || value === undefined) return "";
  if (value === "auto") return "auto";
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function cleanTexts(value: unknown): LiveTexts {
  const source = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const texts = emptyTexts();
  for (const key of LIVE_TEXT_KEYS) texts[key] = text(source[key], 160);
  return texts;
}

export function parseAppearance(value: unknown): LiveAppearance | null {
  if (value === null || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const color = cleanColor(source.color);
  const buttonColor = cleanColor(source.buttonColor);
  const colorDark = cleanColor(source.colorDark);
  const buttonColorDark = cleanColor(source.buttonColorDark);
  if (color === null || buttonColor === null || colorDark === null || buttonColorDark === null) return null;
  const theme = LIVE_THEMES.includes(source.theme as LiveTheme) ? (source.theme as LiveTheme) : "auto";
  return { color, buttonColor, colorDark, buttonColorDark, theme, tr: cleanTexts(source.tr), en: cleanTexts(source.en) };
}

export type LiveSessionPatch = Partial<Pick<LiveSession, "name" | "phone" | "email" | "hostNotes" | "reminderAt" | "reminderDone" | "isNew">>;

export const LIVE_WAIT_SECONDS = 60;
export const LIVE_QUEUE_SECONDS = 10 * 60;
export const LIVE_ROOM_IDLE_HOURS = 2;
export const LIVE_MAX_FILE_BYTES = 10 * 1024 * 1024;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
}

export function cleanName(value: unknown): string {
  return text(value, 60);
}

function groupPhone(rest: string): string {
  return [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean).join(" ");
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+")) {
    if (digits.startsWith("90")) return `+90${digits.length > 2 ? ` ${groupPhone(digits.slice(2, 12))}` : ""}`;
    return `+${digits.slice(0, 15)}`;
  }
  if (digits.startsWith("0")) return `0${digits.length > 1 ? ` ${groupPhone(digits.slice(1, 11))}` : ""}`;
  return groupPhone(digits.slice(0, 10));
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+")) return digits.startsWith("90") ? /^90[2-5]\d{9}$/.test(digits) : digits.length >= 8 && digits.length <= 15;
  return /^[2-5]\d{9}$/.test(digits.startsWith("0") ? digits.slice(1) : digits);
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
