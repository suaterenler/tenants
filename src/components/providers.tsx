"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Locale } from "@/lib/i18n";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

export function Providers({ locale, theme, children }: { locale: Locale; theme: ThemeChoice | null; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={theme ?? "system"} enableSystem storageKey={THEME_COOKIE} disableTransitionOnChange>
      <I18nProvider initialLocale={locale}>
        {children}
        <Toaster richColors expand visibleToasts={5} position="top-right" />
      </I18nProvider>
    </ThemeProvider>
  );
}
