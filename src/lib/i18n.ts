import { en } from "@messages/en";
import { tr, type Messages } from "@messages/tr";

export type { Messages };

export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "edu-locale";

const MESSAGES: Record<Locale, Messages> = { tr, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function dateLocaleTag(locale: Locale): string {
  return locale === "en" ? "en-GB" : "tr-TR";
}
