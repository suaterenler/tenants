import type { Locale } from "./i18n";

type RelativeUnit = "year" | "month" | "day" | "hour" | "minute";

const UNIT_SECONDS: Record<RelativeUnit, number> = {
  year: 31556952,
  month: 2629746,
  day: 86400,
  hour: 3600,
  minute: 60,
};

const UNIT_ORDER: RelativeUnit[] = ["year", "month", "day", "hour", "minute"];

const UNIT_LABEL: Record<Locale, Record<RelativeUnit, string>> = {
  tr: { year: "yıl", month: "ay", day: "gün", hour: "sa", minute: "dk" },
  en: { year: "y", month: "mo", day: "d", hour: "h", minute: "min" },
};

const JUST_NOW: Record<Locale, string> = { tr: "az önce", en: "just now" };
const SOON: Record<Locale, string> = { tr: "birazdan", en: "in a moment" };

function withSuffix(locale: Locale, value: string, future: boolean): string {
  if (locale === "en") return future ? `in ${value}` : `${value} ago`;
  return future ? `${value} sonra` : `${value} önce`;
}

export function relativeTime(date: Date | string | number, now: Date | number = Date.now(), locale: Locale = "tr"): string {
  const target = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const reference = now instanceof Date ? now.getTime() : now;
  if (Number.isNaN(target) || Number.isNaN(reference)) return "";
  const diffMs = target - reference;
  const future = diffMs > 0;
  const abs = Math.abs(diffMs) / 1000;
  if (abs < 60) return future ? SOON[locale] : JUST_NOW[locale];
  const unitIndex = UNIT_ORDER.findIndex((unit) => abs >= UNIT_SECONDS[unit]);
  const primaryUnit = UNIT_ORDER[unitIndex];
  const primaryValue = Math.floor(abs / UNIT_SECONDS[primaryUnit]);
  const remainder = abs - primaryValue * UNIT_SECONDS[primaryUnit];
  const secondaryUnit = UNIT_ORDER[unitIndex + 1];
  const secondaryValue = secondaryUnit ? Math.floor(remainder / UNIT_SECONDS[secondaryUnit]) : 0;
  const labels = UNIT_LABEL[locale];
  const primaryText = `${primaryValue} ${labels[primaryUnit]}`;
  const text = secondaryValue > 0 && secondaryUnit ? `${primaryText} ${secondaryValue} ${labels[secondaryUnit]}` : primaryText;
  return withSuffix(locale, text, future);
}
