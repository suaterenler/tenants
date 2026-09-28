"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n-provider";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let currentNow = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      currentNow = Date.now();
      listeners.forEach((item) => item());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return currentNow;
}

function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function RelativeTimeChip({ value, className }: { value: string | number | Date | null | undefined; className?: string }) {
  const now = useNow();
  const { locale } = useI18n();
  if (value === null || value === undefined || value === "") return null;
  const text = relativeTime(value, now, locale);
  if (!text) return null;
  return <span className={cn("inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground", className)}>{text}</span>;
}
