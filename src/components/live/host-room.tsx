"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CallRoom } from "@/components/live/call-room";
import { BASE_PATH, subscribeToken, tokenState } from "@/lib/admin-client";

export function HostRoom({ code }: { code: string }) {
  const signedIn = useSyncExternalStore(subscribeToken, tokenState, () => null);

  useEffect(() => {
    if (signedIn === false) window.location.replace(BASE_PATH);
  }, [signedIn]);

  if (!signedIn) return null;
  return <CallRoom role="host" code={code} />;
}
