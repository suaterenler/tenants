"use client";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, messages } = useI18n();
  const next: Locale = locale === "tr" ? "en" : "tr";
  return (
    <Button variant="ghost" size="sm" onClick={() => setLocale(next)} aria-label={messages.panel.language} title={messages.panel.language}>
      {next.toUpperCase()}
    </Button>
  );
}
