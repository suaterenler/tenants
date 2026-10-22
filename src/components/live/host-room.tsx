"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CallRoom } from "@/components/live/call-room";
import { BASE_PATH, readToken } from "@/lib/admin-client";

function noopSubscribe(): () => void {
  return () => undefined;
}

export function HostRoom({ code }: { code: string }) {
  const signedIn = useSyncExternalStore(noopSubscribe, () => Boolean(readToken()), () => null);

  useEffect(() => {
    if (signedIn === false) window.location.replace(BASE_PATH);
  }, [signedIn]);

  if (!signedIn) return null;
  return <CallRoom role="host" code={code} />;
}
