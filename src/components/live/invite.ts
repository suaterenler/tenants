"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/admin-client";
import { buildInviteUrl } from "@/lib/live";

let cached: Promise<string> | null = null;

export function loadInviteBase(): Promise<string> {
  cached ??= fetch(`${BASE_PATH}/api/live/public/status`, { cache: "no-store" })
    .then((response) => response.json() as Promise<{ inviteBase?: unknown }>)
    .then((data) => (typeof data.inviteBase === "string" ? data.inviteBase : ""))
    .catch(() => {
      cached = null;
      return "";
    });
  return cached;
}

export function inviteUrl(code: string, base: string): string {
  if (typeof window === "undefined") return base ? `${base}/${code}` : `${BASE_PATH}/live/join/${code}`;
  return buildInviteUrl(code, base, window.location.origin, BASE_PATH);
}

export function useInviteBase(): string {
  const [base, setBase] = useState("");
  useEffect(() => {
    let alive = true;
    void loadInviteBase().then((value) => {
      if (alive) setBase(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return base;
}
