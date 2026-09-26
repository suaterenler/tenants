"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { THEME_COOKIE } from "@/lib/theme";

export function ThemeToggle() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t.panel.theme} title={t.panel.theme}>
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
