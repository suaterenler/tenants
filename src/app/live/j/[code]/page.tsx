import type { Metadata } from "next";
import { CallRoom } from "@/components/live/call-room";

export const metadata: Metadata = { title: "Canlı Görüşme · Erenler Yazılım" };

export default async function GuestRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  return <CallRoom role="guest" code={code} />;
}
