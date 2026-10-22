import { HostRoom } from "@/components/live/host-room";

export default async function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  return <HostRoom code={code} />;
}
