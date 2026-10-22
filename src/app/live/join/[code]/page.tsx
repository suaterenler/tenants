import type { Metadata } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/i18n-provider";
import { CallRoom } from "@/components/live/call-room";
import { LOCALE_COOKIE, isLocale, resolveLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Canlı Görüşme · Erenler Yazılım" };

export default async function GuestRoomPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ lang?: string }> }) {
  const code = (await params).code.toUpperCase();
  const { lang } = await searchParams;
  const locale = isLocale(lang) ? lang : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <I18nProvider initialLocale={locale}>
      <CallRoom role="guest" code={code} />
    </I18nProvider>
  );
}
