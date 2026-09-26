"use client";

import { useT } from "@/components/i18n-provider";

export const COMPANY_NAME = "Erenler Yazılım";
export const COMPANY_URL = "https://erenleryazilim.com";

export function MadeBy() {
  const t = useT();
  const [before, after = ""] = t.auth.madeBy.split("{company}");
  return (
    <>
      {before}
      <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:text-foreground hover:underline">
        {COMPANY_NAME}
      </a>
      {after}
    </>
  );
}
