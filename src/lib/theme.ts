export const THEME_COOKIE = "edu-theme";

export type ThemeChoice = "light" | "dark";

export function resolveTheme(value: string | undefined): ThemeChoice | null {
  return value === "light" || value === "dark" ? value : null;
}
