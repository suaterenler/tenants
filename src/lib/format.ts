import { dateLocaleTag, type Locale } from "./i18n";

export function formatDateTime(value: string | Date, locale: Locale = "tr"): string {
  return new Date(value).toLocaleString(dateLocaleTag(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string, locale: Locale = "tr"): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString(dateLocaleTag(locale), { day: "2-digit", month: "2-digit", year: "numeric" });
}
