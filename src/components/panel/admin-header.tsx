"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Inbox, LogOut, Video } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

const COUNT_REFRESH_MS = 60_000;

export function AdminHeader({ active, onSignOut, newCount, liveCount }: { active: "tenants" | "requests" | "live"; onSignOut: () => void; newCount?: number; liveCount?: number }) {
  const t = useI18n().messages;
  const [fetched, setFetched] = useState(0);
  const [liveFetched, setLiveFetched] = useState(0);
  const count = newCount ?? fetched;
  const callCount = liveCount ?? liveFetched;

  useEffect(() => {
    let alive = true;
    const load = () =>
      adminFetch<{ count: number }>("/requests/count")
        .then((data) => {
          if (alive) setFetched(data.count);
        })
        .catch(() => undefined);
    const loadLive = () =>
      adminFetch<{ count: number }>("/live/count")
        .then((data) => {
          if (alive) setLiveFetched(data.count);
        })
        .catch(() => undefined);
    const loadAll = () => {
      void load();
      void loadLive();
    };
    loadAll();
    const timer = window.setInterval(loadAll, COUNT_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const link = (isActive: boolean) => cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted", isActive ? "bg-muted text-foreground" : "text-muted-foreground");

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <nav className="flex items-center gap-1">
        <Link href="/" className={link(active === "tenants")} title={t.tenants.title}>
          <Building2 className="size-4" />
          <span className="hidden sm:inline">{t.tenants.title}</span>
        </Link>
        <Link href="/requests" className={link(active === "requests")} title={t.requests.title}>
          <Inbox className="size-4" />
          <span className="hidden sm:inline">{t.requests.title}</span>
          {count > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">{count}</span> : null}
        </Link>
        <Link href="/live" className={link(active === "live")} title={t.live.title}>
          <Video className="size-4" />
          <span className="hidden sm:inline">{t.live.title}</span>
          {callCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">{callCount}</span> : null}
        </Link>
      </nav>
      <div className="flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="size-4" />
          {t.tenants.logout}
        </Button>
      </div>
    </header>
  );
}
