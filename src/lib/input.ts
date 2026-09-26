export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function optText(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed === "" ? null : trimmed;
}

export function rawPassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.trim().replace(",", ".")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function optId(value: unknown): number | null {
  const parsed = numberOr(value, Number.NaN);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function dateKey(value: unknown): string | null {
  const key = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
}

export function dateTimeKey(value: unknown): { date: string; time: string | null } | null {
  const [datePart, timePart] = text(value).split("T");
  const date = dateKey(datePart);
  if (!date) return null;
  if (!timePart) return { date, time: null };
  const time = timeKey(timePart.slice(0, 5));
  return time ? { date, time } : null;
}

export function wallClock(date: string, time: string | null): Date {
  return new Date(`${date}T${time ?? "00:00"}:00.000Z`);
}

export function timeKey(value: unknown): string | null {
  const key = text(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(key) ? key : null;
}

export function oneOf<T extends string>(list: readonly T[], value: unknown): T | null {
  return list.find((item) => item === value) ?? null;
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function optUploadPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(value) ? value : null;
}
