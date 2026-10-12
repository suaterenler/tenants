import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";
import "@/fonts/geist.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Erenler Yönetim",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html lang={locale} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body className="antialiased">
        <Providers locale={locale} theme={theme}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
