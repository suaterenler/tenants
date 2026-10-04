"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Inbox, LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

const COUNT_REFRESH_MS = 60_000;

export function AdminHeader({ active, onSignOut, newCount }: { active: "tenants" | "requests"; onSignOut: () => void; newCount?: number }) {
  const t = useI18n().messages;
  const [fetched, setFetched] = useState(0);
  const count = newCount ?? fetched;

  useEffect(() => {
    let alive = true;
    const load = () =>
      adminFetch<{ count: number }>("/requests/count")
        .then((data) => {
          if (alive) setFetched(data.count);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => void load(), COUNT_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const link = (isActive: boolean) => cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted", isActive ? "bg-muted text-foreground" : "text-muted-foreground");

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <nav className="flex items-center gap-1">
        <Link href="/" className={link(active === "tenants")}>
          <Building2 className="size-4" />
          {t.tenants.title}
        </Link>
        <Link href="/requests" className={link(active === "requests")}>
          <Inbox className="size-4" />
          {t.requests.title}
          {count > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">{count}</span> : null}
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
