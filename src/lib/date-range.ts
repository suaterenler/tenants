export type RangePreset = "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth";
export type RangeValue = { from: string; to: string };

export const RANGE_PRESETS: RangePreset[] = ["today", "yesterday", "thisWeek", "thisMonth", "lastMonth"];

export type FuturePreset = "today" | "thisWeek" | "thisMonth" | "nextMonth" | "next30";

export const FUTURE_PRESETS: FuturePreset[] = ["today", "thisWeek", "thisMonth", "nextMonth", "next30"];

const pad = (value: number) => String(value).padStart(2, "0");

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function presetRange(preset: RangePreset, now: Date = new Date()): RangeValue {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: toDateKey(today), to: toDateKey(today) };
    case "yesterday": {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      return { from: toDateKey(day), to: toDateKey(day) };
    }
    case "thisWeek": {
      const offset = (today.getDay() + 6) % 7;
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)), to: toDateKey(today) };
    }
    case "thisMonth":
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: toDateKey(today) };
    case "lastMonth":
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: toDateKey(new Date(today.getFullYear(), today.getMonth(), 0)) };
  }
}

export function futurePresetRange(preset: FuturePreset, now: Date = new Date()): RangeValue {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: toDateKey(today), to: toDateKey(today) };
    case "thisWeek": {
      const offset = (today.getDay() + 6) % 7;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      return { from: toDateKey(monday), to: toDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)) };
    }
    case "thisMonth":
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: toDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
    case "nextMonth":
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 1)), to: toDateKey(new Date(today.getFullYear(), today.getMonth() + 2, 0)) };
    case "next30":
      return { from: toDateKey(today), to: toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)) };
  }
}
