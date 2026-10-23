"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronUp,
  Copy,
  ImagePlus,
  LayoutGrid,
  LayoutPanelLeft,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  NotebookPen,
  Paperclip,
  Pencil,
  PhoneOff,
  PictureInPicture2,
  Pin,
  PinOff,
  RefreshCw,
  Send,
  SignalHigh,
  SignalLow,
  SignalZero,
  Star,
  SwitchCamera,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  Video,
  VideoOff,
  Volume2,
  WandSparkles,
  WifiOff,
  X,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { BackgroundEffect, type BackgroundMode } from "@/components/live/background-effect";
import { inviteUrl, useInviteBase } from "@/components/live/invite";
import { FileIcon, isImageFile, LinkedText } from "@/components/live/linked-text";
import { RequestAgain } from "@/components/live/request-again";
import { HttpError, RoomClient, type RemotePeer, type RoomMessage, type RoomState } from "@/components/live/room-client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BASE_PATH, adminFetch } from "@/lib/admin-client";
import { formatBytes } from "@/lib/format";
import { initials, isAllowedFile, LIVE_FILE_EXTENSIONS, LIVE_MAX_FILE_BYTES, type LiveRole } from "@/lib/live";
import { cn } from "@/lib/utils";

type Quality = "good" | "weak" | "lost";
type Devices = { audioinput: MediaDeviceInfo[]; videoinput: MediaDeviceInfo[]; audiooutput: MediaDeviceInfo[] };
type View = "grid" | "focus" | "speaker";
type RoomText = ReturnType<typeof useI18n>["messages"]["live"]["room"];

const NAME_KEY = "erenler_live_name";

const BACKGROUND_COLORS = ["#1e3a8a", "#2563eb", "#0891b2", "#0f766e", "#16a34a", "#7c3aed", "#db2777", "#ea580c", "#a8a29e", "#374151"];

const BACKGROUND_TEMPLATES = ["office", "library", "lounge", "bokeh", "waves", "sunset"] as const;

const GRID_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2",
  5: "grid-cols-2 lg:grid-cols-3",
  6: "grid-cols-2 lg:grid-cols-3",
  7: "grid-cols-2 lg:grid-cols-3",
  8: "grid-cols-2 lg:grid-cols-4",
  9: "grid-cols-2 lg:grid-cols-3",
  10: "grid-cols-2 lg:grid-cols-4",
  11: "grid-cols-2 lg:grid-cols-4",
  12: "grid-cols-2 lg:grid-cols-4",
};

function hueOf(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function useElapsed(running: boolean): string {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const total = Math.floor((now - start) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function clock(at: string): string {
  return new Date(at).toLocaleTimeString(document.documentElement.lang === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

let chimeAudio: AudioContext | null = null;

function playTones(tones: [number, number][], volume: number, length: number): void {
  try {
    chimeAudio ??= new AudioContext();
    const ctx = chimeAudio;
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime + 0.05;
    for (const [offset, frequency] of tones) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + offset;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + length + 0.05);
    }
  } catch {
    return;
  }
}

function knockChime(): void {
  playTones(
    [
      [0, 988],
      [0.22, 784],
      [0.7, 988],
      [0.92, 784],
    ],
    0.3,
    0.35,
  );
}

function messageChime(): void {
  playTones(
    [
      [0, 784],
      [0.1, 1175],
    ],
    0.12,
    0.18,
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function noopSubscribe(): () => void {
  return () => undefined;
}

function storeName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    return;
  }
}

export function CallRoom({ role, code }: { role: LiveRole; code: string }) {
  const { messages: all } = useI18n();
  const t = all.live.room;
  const [requestToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const match = /(?:^|[#&])t=([^&]+)/.exec(window.location.hash);
    return match ? decodeURIComponent(match[1]) : "";
  });
  const [client] = useState(() => new RoomClient({ code, role, token: requestToken }));
  const [room, setRoom] = useState<RoomState>(client.state);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState(false);
  const [hostName, setHostName] = useState("");

  useEffect(() => {
    const unsubscribe = client.subscribe(() => setRoom(client.state));
    const timer = window.setTimeout(() => {
      client.revive();
      const name = role === "guest" && !requestToken ? readName() : "";
      if (role === "guest" && !requestToken && !name) {
        void client.check().then((result) => {
          setHostName(result.hostName);
          if (result.valid) setRoom({ ...client.state, phase: "name" });
        });
      } else void client.join(name);
    }, 0);
    const unload = () => client.leaveOnUnload();
    window.addEventListener("pagehide", unload);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", unload);
      unsubscribe();
      client.leaveOnUnload();
      client.dispose();
    };
  }, [client, role, requestToken]);

  const terminal = room.phase === "ended" || room.phase === "kicked" || room.phase === "denied" || room.phase === "closed";
  const embedded = typeof window !== "undefined" && window.parent !== window;

  useEffect(() => {
    if (terminal && embedded) window.parent.postMessage({ type: "erenler-live:ended" }, "*");
  }, [terminal, embedded]);

  function backToSite() {
    if (embedded) window.parent.postMessage({ type: "erenler-live:close" }, "*");
    else if (document.referrer) window.location.href = document.referrer;
    else window.close();
  }

  function submitName() {
    const name = nameDraft.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    storeName(name);
    void client.join(name);
  }

  if (room.phase === "live") return <LiveRoom client={client} room={room} code={code} t={t} />;

  const retryButton = (
    <Button variant="secondary" className="h-10" onClick={() => window.location.reload()}>
      <RefreshCw className="size-4" />
      {t.retry}
    </Button>
  );

  const icon =
    room.phase === "ended" ? <Check className="size-7" /> : room.phase === "kicked" || room.phase === "denied" ? <Ban className="size-7" /> : room.phase === "closed" || room.phase === "error" ? <WifiOff className="size-7" /> : <Loader2 className="size-7 animate-spin" />;
  const title =
    room.phase === "ended"
      ? t.ended
      : room.phase === "kicked"
        ? t.kicked
        : room.phase === "denied"
          ? t.denied
          : room.phase === "closed"
            ? room.error === "notFound"
              ? t.invalidLink
              : t.closed
            : room.phase === "error"
              ? t.failed
              : room.phase === "pending"
                ? t.waitingApproval
                : room.phase === "name"
                  ? t.namePrompt
                  : t.joining;

  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-neutral-100">
      <div className={cn("flex w-full flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center sm:p-8", role === "guest" && !embedded && (room.phase === "ended" || (room.phase === "closed" && room.error !== "notFound")) ? "max-w-sm sm:max-w-xl" : "max-w-sm")}>
        {room.phase === "name" ? (
          <form
            className="flex w-full flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitName();
            }}
          >
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
              <Video className="size-7" />
            </span>
            <h1 className="text-xl font-semibold">{t.namePrompt}</h1>
            {hostName ? (
              <div className="flex items-center justify-center gap-2 text-sm text-neutral-300">
                <span className="flex size-7 items-center justify-center rounded-full bg-sky-700 text-xs font-semibold text-white">{initials(hostName)}</span>
                <span>
                  {t.hostLabel} <strong className="font-semibold text-white">{hostName}</strong>
                </span>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="live-join-name" className="text-sm text-neutral-300">
                {t.nameLabel}
              </label>
              <Input
                id="live-join-name"
                autoFocus
                maxLength={60}
                value={nameDraft}
                aria-invalid={nameError || undefined}
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setNameError(false);
                }}
                className="h-10 border-white/15 bg-black/30"
              />
              {nameError ? <span className="text-xs text-red-400">{all.errors.liveNameRequired}</span> : null}
            </div>
            <Button type="submit" className="h-10 bg-sky-600 text-white hover:bg-sky-700">
              {t.join}
            </Button>
          </form>
        ) : (
          <>
            <span className={cn("flex size-14 items-center justify-center rounded-full", room.phase === "ended" ? "bg-emerald-500/15 text-emerald-400" : room.phase === "kicked" || room.phase === "denied" || room.phase === "closed" || room.phase === "error" ? "bg-red-500/15 text-red-400" : "bg-sky-500/15 text-sky-300")}>{icon}</span>
            <h1 className="text-xl font-semibold">{title}</h1>
            {room.phase === "ended" ? <p className="text-sm text-neutral-400">{t.endedHint}</p> : null}
            {room.error && room.phase === "error" ? <p className="text-sm text-neutral-400">{room.error}</p> : null}
            <p className="rounded-md bg-white/5 px-3 py-1 font-mono text-base tracking-wider text-neutral-300">{code}</p>
            {role === "host" && (room.phase === "ended" || room.phase === "closed") ? (
              <Button variant="secondary" render={<a href={`${BASE_PATH}/live`} />}>
                {all.live.title}
              </Button>
            ) : role === "guest" && !embedded && (room.phase === "ended" || (room.phase === "closed" && room.error !== "notFound")) ? (
              <RequestAgain />
            ) : room.phase === "error" ? (
              retryButton
            ) : null}
            {role === "guest" && terminal && embedded ? <p className="text-xs text-neutral-500">{t.autoClose}</p> : null}
          </>
        )}
      </div>
      {role === "guest" && room.phase !== "name" && (terminal || room.phase === "error") ? (
        <Button variant="ghost" className="text-neutral-300 hover:text-white" onClick={backToSite}>
          <ArrowLeft className="size-4" />
          {t.backToSite}
        </Button>
      ) : null}
      {role === "guest" && !embedded ? (
        <a href="https://erenleryazilim.com" target="_blank" rel="noopener" className="text-xs text-neutral-500 hover:text-neutral-300">
          {t.poweredBy}
        </a>
      ) : null}
    </div>
  );
}

function LiveRoom({ client, room, code, t }: { client: RoomClient; room: RoomState; code: string; t: RoomText }) {
  const { messages: all, locale } = useI18n();
  const role = room.role;
  const me = room.selfName;
  const elapsed = useElapsed(true);

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const screenVideo = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const effectRef = useRef<BackgroundEffect | null>(null);
  const effectStream = useRef<MediaStream | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const selfTalking = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [devices, setDevices] = useState<Devices>({ audioinput: [], videoinput: [], audiooutput: [] });
  const [micId, setMicId] = useState("");
  const [camId, setCamId] = useState("");
  const [facing, setFacing] = useState("");
  const touch = useSyncExternalStore(noopSubscribe, () => window.matchMedia("(pointer: coarse)").matches, () => false);
  const [speakerId, setSpeakerId] = useState("");
  const [level, setLevel] = useState(0);
  const [panel, setPanel] = useState<"chat" | "notes" | null>(null);
  const [unread, setUnread] = useState(0);
  const [preview, setPreview] = useState<RoomMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState(room.hostNotes);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; label: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [view, setView] = useState<View>("grid");
  const [pinned, setPinned] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundMode>({ kind: "none" });
  const backgroundRef = useRef<BackgroundMode>(background);
  useEffect(() => {
    backgroundRef.current = background;
  }, [background]);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [sharingLocal, setSharingLocal] = useState(false);

  const peers = room.peers;
  const sharer = room.sharer === room.selfId ? "me" : room.sharer;
  const someoneElseSharing = sharer !== null && sharer !== "me";
  const canShare = role === "host" || room.guestShare;
  const quality: Quality = !room.online ? "lost" : peers.some((peer) => peer.rtc === "reconnecting" || peer.rtc === "failed") ? "weak" : "good";

  const showLocal = useCallback(() => {
    const stream = effectStream.current ?? streamRef.current;
    if (localVideo.current && stream && localVideo.current.srcObject !== stream) localVideo.current.srcObject = stream;
  }, []);

  const attachLocal = useCallback(
    (element: HTMLVideoElement | null) => {
      localVideo.current = element;
      showLocal();
    },
    [showLocal],
  );

  const attachScreen = useCallback((element: HTMLVideoElement | null) => {
    screenVideo.current = element;
    if (element && screenRef.current && element.srcObject !== screenRef.current) element.srcObject = screenRef.current;
  }, []);

  const pushVideo = useCallback(() => {
    const track = effectStream.current?.getVideoTracks()[0] ?? streamRef.current?.getVideoTracks()[0] ?? null;
    client.setTracks({ video: track });
  }, [client]);

  const startMedia = useCallback(
    async (mic: string, cam: string, facingMode?: string) => {
      const previous = streamRef.current;
      if (facingMode) previous?.getVideoTracks().forEach((track) => track.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: mic ? { deviceId: { exact: mic }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
          video: facingMode
            ? { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : cam
              ? { deviceId: { exact: cam }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        previous?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        setBlocked(false);
        stream.getAudioTracks().forEach((track) => (track.enabled = micOn));
        stream.getVideoTracks().forEach((track) => (track.enabled = camOn));
        const nextFacing = stream.getVideoTracks()[0]?.getSettings().facingMode ?? facingMode ?? "";
        if (effectRef.current && effectStream.current) {
          effectRef.current.stop();
          const effect = new BackgroundEffect();
          effect.setMirrorImage(nextFacing !== "environment");
          effectStream.current = await effect.start(stream, backgroundRef.current);
          effectRef.current = effect;
        }
        showLocal();
        client.setTracks({ audio: stream.getAudioTracks()[0] ?? null });
        pushVideo();
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          audioinput: list.filter((item) => item.kind === "audioinput"),
          videoinput: list.filter((item) => item.kind === "videoinput"),
          audiooutput: list.filter((item) => item.kind === "audiooutput"),
        });
        setMicId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? "");
        setCamId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
        setFacing(nextFacing);
      } catch {
        setBlocked(true);
        setCamOn(false);
        void client.post({ kind: "state", muted: true, camera: false }).catch(() => undefined);
      }
    },
    [client, showLocal, pushVideo, micOn, camOn],
  );

  const startRef = useRef(startMedia);
  useEffect(() => {
    startRef.current = startMedia;
  }, [startMedia]);

  useEffect(() => {
    const timer = window.setTimeout(() => void startRef.current("", ""), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      screenRef.current?.getTracks().forEach((track) => track.stop());
      effectRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (window.parent !== window) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    client.onIncoming = (message) => {
      messageChime();
      setPanel((current) => {
        if (current !== "chat") {
          setUnread((count) => count + 1);
          setPreview(message);
        }
        return current;
      });
    };
    return () => {
      client.onIncoming = null;
    };
  }, [client]);

  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(() => setPreview(null), 6000);
    return () => window.clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) return;
    const context = new AudioContext();
    const resume = () => {
      if (context.state === "suspended") void context.resume();
      client.resumeAudio();
    };
    resume();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let lastVoice = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const value = Math.min(1, data.reduce((sum, item) => sum + item, 0) / data.length / 60);
      setLevel(value);
      const now = performance.now();
      if (value > 0.15) lastVoice = now;
      const talking = now - lastVoice < 600;
      if (talking !== selfTalking.current) {
        selfTalking.current = talking;
        if (talking) setActiveSpeaker("me");
      }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      void context.close();
    };
  }, [micId, client]);

  const speakingPeer = peers.find((peer) => peer.speaking)?.peerId ?? null;
  const [lastRemote, setLastRemote] = useState<string | null>(null);
  if (speakingPeer && speakingPeer !== lastRemote) setLastRemote(speakingPeer);
  const currentSpeaker = speakingPeer ?? (selfTalking.current ? "me" : (lastRemote && peers.some((peer) => peer.peerId === lastRemote) ? lastRemote : activeSpeaker));

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [room.messages.length, panel]);

  useEffect(() => {
    if (sharer !== "me" && sharingLocal) {
      screenRef.current?.getTracks().forEach((track) => track.stop());
      screenRef.current = null;
      client.setTracks({ screen: null });
      setTimeout(() => setSharingLocal(false), 0);
    }
  }, [sharer, sharingLocal, client]);

  useEffect(() => {
    if (role !== "host" || !room.sessionId || notes === room.hostNotes) return;
    const timer = window.setTimeout(() => {
      setNotesState("saving");
      void adminFetch(`/live/sessions/${room.sessionId}`, { method: "PATCH", body: { hostNotes: notes } })
        .then(() => setNotesState("saved"))
        .catch(() => setNotesState("idle"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [notes, role, room.sessionId, room.hostNotes]);

  const inviteBase = useInviteBase();
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    effectRef.current?.setMirrorImage(facing !== "environment");
  }, [facing, background]);

  const pipRef = useRef<HTMLVideoElement | null>(null);
  const [pipOn, setPipOn] = useState(false);
  const pipSupported = useSyncExternalStore(noopSubscribe, () => document.pictureInPictureEnabled === true, () => false);

  async function togglePip() {
    const video = pipRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      toast.error(t.pipFailed);
    }
  }

  function backgroundMenu(trigger: React.ReactElement) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent className="dark w-64 border-white/10 bg-neutral-900 text-neutral-100" side="bottom" align="center">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t.bg}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={background.kind === "blur" ? `blur-${background.strength}` : background.kind}
              onValueChange={(value) => {
                const key = String(value);
                if (key === "none") void changeBackground({ kind: "none" });
                else if (key === "blur-6") void changeBackground({ kind: "blur", strength: 6 });
                else if (key === "blur-16") void changeBackground({ kind: "blur", strength: 16 });
              }}
            >
              <DropdownMenuRadioItem value="none">{t.bgNone}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="blur-6">{t.bgBlurLight}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="blur-16">{t.bgBlurStrong}</DropdownMenuRadioItem>
              {background.kind === "image" && background.src.startsWith("data:") ? <DropdownMenuRadioItem value="image">{t.bgImage}</DropdownMenuRadioItem> : null}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t.bgColor}</DropdownMenuLabel>
            <div className="grid grid-cols-5 gap-1.5 px-1.5 pb-1.5">
              {BACKGROUND_COLORS.map((color) => {
                const selected = background.kind === "color" && background.color === color;
                return (
                  <DropdownMenuItem
                    key={color}
                    onClick={() => void changeBackground({ kind: "color", color })}
                    title={color}
                    aria-label={`${t.bgColor} ${color}`}
                    className={cn("flex aspect-square items-center justify-center rounded-lg p-0 ring-offset-2 ring-offset-neutral-900 focus:ring-2 focus:ring-white/60", selected && "ring-2 ring-white")}
                    style={{ background: color }}
                  >
                    {selected ? <Check className="size-4 text-white drop-shadow" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t.bgTemplates}</DropdownMenuLabel>
            <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-1.5">
              {BACKGROUND_TEMPLATES.map((name) => {
                const src = `${BASE_PATH}/live/backgrounds/${name}.webp`;
                const selected = background.kind === "image" && background.src === src;
                return (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => void changeBackground({ kind: "image", src })}
                    title={t.bgTemplate[name]}
                    aria-label={t.bgTemplate[name]}
                    className={cn("relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-cover bg-center p-0 ring-offset-2 ring-offset-neutral-900 focus:ring-2 focus:ring-white/60", selected && "ring-2 ring-white")}
                    style={{ backgroundImage: `url(${BASE_PATH}/live/backgrounds/${name}-thumb.webp)` }}
                  >
                    {selected ? <Check className="size-4 text-white drop-shadow" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => uploadRef.current?.click()}>
            <ImagePlus className="size-4" />
            {t.bgUpload}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const knockKey = role === "host" ? room.knocks.map((knock) => knock.peerId).join(",") : "";

  useEffect(() => {
    if (!knockKey) return;
    let count = 0;
    knockChime();
    const timer = window.setInterval(() => {
      count += 1;
      if (count >= 8) window.clearInterval(timer);
      else knockChime();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [knockKey]);

  function unlockAudio() {
    client.resumeAudio();
    const videos = [...document.querySelectorAll("video")].filter((video) => !video.muted);
    void Promise.all(videos.map((video) => video.play())).then(
      () => setAudioBlocked(false),
      () => setAudioBlocked(true),
    );
  }

  function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = next));
    void client.post({ kind: "state", muted: !next, camera: camOn }).catch(() => undefined);
  }

  function toggleCam() {
    const next = !camOn;
    setCamOn(next);
    streamRef.current?.getVideoTracks().forEach((track) => (track.enabled = next));
    if (next) showLocal();
    void client.post({ kind: "state", muted: !micOn, camera: next }).catch(() => undefined);
  }

  async function changeBackground(mode: BackgroundMode) {
    setBackground(mode);
    if (mode.kind === "none") {
      effectRef.current?.stop();
      effectRef.current = null;
      effectStream.current = null;
      showLocal();
      pushVideo();
      return;
    }
    if (effectRef.current && effectStream.current) {
      effectRef.current.setMode(mode);
      return;
    }
    const source = streamRef.current;
    if (!source) return;
    setBackgroundBusy(true);
    try {
      const effect = new BackgroundEffect();
      effect.setMirrorImage(facing !== "environment");
      effectStream.current = await effect.start(source, mode);
      effectRef.current = effect;
      showLocal();
      pushVideo();
    } catch {
      setBackground({ kind: "none" });
      toast.error(t.bgFailed);
    } finally {
      setBackgroundBusy(false);
    }
  }

  function pickImage(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") void changeBackground({ kind: "image", src: reader.result });
    };
    reader.readAsDataURL(file);
  }

  async function startShare() {
    if (someoneElseSharing && role !== "host") return;
    let stream: MediaStream;
    try {
      const options: DisplayMediaStreamOptions & { selfBrowserSurface?: string } = { video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 15, max: 15 } }, audio: false, selfBrowserSurface: "exclude" };
      stream = await navigator.mediaDevices.getDisplayMedia(options);
    } catch {
      return;
    }
    stream.getVideoTracks().forEach((track) => (track.contentHint = "detail"));
    try {
      await client.post({ kind: "share", on: true });
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      toast.error(error instanceof Error ? error.message : t.failed);
      return;
    }
    screenRef.current = stream;
    setSharingLocal(true);
    const track = stream.getVideoTracks()[0] ?? null;
    client.setTracks({ screen: track });
    track?.addEventListener("ended", () => stopShare());
    if (screenVideo.current) screenVideo.current.srcObject = stream;
  }

  function stopShare() {
    screenRef.current?.getTracks().forEach((track) => track.stop());
    screenRef.current = null;
    setSharingLocal(false);
    client.setTracks({ screen: null });
    void client.post({ kind: "share", on: false }).catch(() => undefined);
  }

  function openPanel(next: "chat" | "notes") {
    setPanel((current) => (current === next ? null : next));
    if (next === "chat") {
      setUnread(0);
      setPreview(null);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await client.post({ kind: "chat", text });
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.failed);
    } finally {
      setSending(false);
    }
  }

  async function sendFiles(files: File[]) {
    for (const file of files.slice(0, 5)) await sendFile(file);
  }

  async function sendFile(file: File | undefined) {
    if (!file) return;
    if (!isAllowedFile(file.name)) {
      toast.error(all.errors.liveFileType);
      return;
    }
    if (file.size > LIVE_MAX_FILE_BYTES) {
      toast.error(all.errors.liveFileTooLarge);
      return;
    }
    setSending(true);
    try {
      const uploaded = await client.upload(file);
      await client.post({ kind: "chat", text: "", file: uploaded });
    } catch (error) {
      toast.error(error instanceof HttpError || error instanceof Error ? error.message : t.failed);
    } finally {
      setSending(false);
    }
  }

  async function copyInvite() {
    const ok = await copyText(`${inviteUrl(code, inviteBase)}${locale === "en" ? "?lang=en" : ""}`);
    if (ok) toast.success(all.live.linkCopied);
    else toast.error(t.failed);
  }

  function setSetting(patch: { approveJoin?: boolean; guestShare?: boolean }) {
    void client.post({ kind: "settings", ...patch }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : t.failed));
  }

  function togglePin(id: string) {
    if (pinned === id) {
      setPinned(null);
      return;
    }
    setPinned(id);
    if (view === "grid") setView("focus");
  }

  function askKick(peer: RemotePeer) {
    setConfirm({
      message: t.kickConfirm.replace("{name}", peer.name),
      label: t.kick,
      action: () => void client.post({ kind: "kick", peerId: peer.peerId }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : t.failed)),
    });
  }

  function saveName() {
    const name = (renaming ?? "").trim();
    if (!name) return;
    setRenaming(null);
    if (role === "guest") storeName(name);
    void client.post({ kind: "rename", name }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : t.failed));
  }

  function finish() {
    stopLocal();
    void client.leave();
  }

  function endForAll() {
    stopLocal();
    void client.end();
  }

  function stopLocal() {
    screenRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
    effectRef.current?.stop();
  }

  const focusId = pinned && (pinned === "me" || peers.some((peer) => peer.peerId === pinned)) ? pinned : currentSpeaker && (currentSpeaker === "me" || peers.some((peer) => peer.peerId === currentSpeaker)) ? currentSpeaker : (peers[0]?.peerId ?? "me");

  function renderTile(id: string, small: boolean) {
    const tileButton = (label: string, onClick: () => void, icon: ReactNode, extra = "") => (
      <button type="button" onClick={onClick} title={label} aria-label={label} className={cn("inline-flex size-7 items-center justify-center rounded-md bg-black/60 text-white transition-opacity hover:bg-black/80 focus-visible:opacity-100", extra)}>
        {icon}
      </button>
    );
    const pin = tileButton(pinned === id ? t.unpin : t.pin, () => togglePin(id), pinned === id ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />, cn(pinned === id ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100 pointer-coarse:opacity-100", small && "size-6"));
    if (id === "me") {
      return (
        <div className="group/tile relative size-full">
          <SelfTile videoRef={attachLocal} name={me} camOn={camOn} mirror={facing !== "environment"} micOn={micOn} blocked={blocked} level={level} small={small} youLabel={t.you} blockedText={t.cameraBlocked} host={role === "host"} hostLabel={t.host} />
          {small ? (
            <div className={cn("absolute top-1.5 left-1.5 z-10 flex items-center gap-1", role === "host" ? "right-9" : "right-1.5")}>
              {touch ? null : pin}
              <NameTag compact name={me === t.you ? me : `${me} (${t.you})`} muted={!micOn} />
            </div>
          ) : (
            <div className="absolute top-2 left-2 z-10 flex gap-1">
              {pin}
              {tileButton(t.rename, () => setRenaming(me), <Pencil className="size-3.5" />, "opacity-0 group-hover/tile:opacity-100 pointer-coarse:opacity-100")}
            </div>
          )}
          {touch && camOn && !blocked ? (
            <div className={cn("absolute z-10 flex", small ? "right-1.5 bottom-1.5 gap-1" : "right-2 bottom-2 gap-1.5")}>
              {backgroundMenu(
                <button type="button" title={t.bg} aria-label={t.bg} className={cn("inline-flex items-center justify-center rounded-full bg-black/60 text-white", small ? "size-8" : "size-9", background.kind !== "none" && "bg-sky-600")}>
                  {backgroundBusy ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                </button>,
              )}
              {canFlip ? tileButton(t.flipCamera, () => void startMedia(micId, "", facing === "environment" ? "user" : "environment"), <SwitchCamera className="size-4" />, small ? "size-8 rounded-full" : "size-9 rounded-full") : null}
            </div>
          ) : null}
        </div>
      );
    }
    const peer = peers.find((entry) => entry.peerId === id);
    if (!peer) return null;
    return (
      <div className="group/tile relative size-full">
        <PeerTile peer={peer} small={small} hostLost={room.hostLost} speakerId={speakerId} onAudioBlocked={() => setAudioBlocked(true)} t={t} />
        <div className={cn("absolute z-10 flex items-center gap-1", small ? cn("top-1.5 left-1.5", peer.role === "host" ? "right-9" : "right-1.5") : "top-2 left-2")}>
          {pin}
          {role === "host" && peer.role !== "host" ? tileButton(t.kick, () => askKick(peer), <UserMinus className="size-3.5" />, cn("opacity-0 group-hover/tile:opacity-100 pointer-coarse:opacity-100 hover:bg-red-600", small && "size-6")) : null}
          {small ? <NameTag compact name={peer.name} muted={peer.muted} /> : null}
        </div>
      </div>
    );
  }

  const tiles = useMemo(() => ["me", ...peers.map((peer) => peer.peerId)], [peers]);
  const sharerPeer = someoneElseSharing ? peers.find((peer) => peer.peerId === sharer) : undefined;
  const sharerName = sharer === "me" ? me : (sharerPeer?.name ?? "");
  const pipCandidates = [pinned, speakingPeer, lastRemote, focusId];
  const pipPeer =
    pipCandidates.map((id) => peers.find((peer) => peer.peerId === id && peer.camera && peer.stream)).find(Boolean) ??
    peers.find((peer) => peer.camera && peer.stream) ??
    peers[0];
  const pipStream = sharerPeer?.screen ?? pipPeer?.stream ?? null;
  const canFlip = touch && Boolean(facing) && devices.videoinput.length > 1;
  const pipHiddenId = pipOn && !sharerPeer?.screen ? pipPeer?.peerId : undefined;
  const layoutTiles = tiles.filter((id) => id !== pipHiddenId);
  const layoutFocus = focusId === pipHiddenId ? (layoutTiles.find((id) => id !== "me") ?? "me") : focusId;
  const cornerId = layoutFocus === "me" ? layoutTiles.find((id) => id !== "me") : "me";
  const mine =(message: RoomMessage) => (message.peerId ? message.peerId === room.selfId : message.author === me && message.role === role);

  return (
    <div className="dark flex h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      <PipVideo videoRef={pipRef} stream={pipStream} onChange={setPipOn} />
      <header className="relative z-20 flex items-center gap-2 border-b border-white/10 bg-neutral-900 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-bold text-white">E</span>
          <div className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate text-sm font-medium">Erenler Yazılım</span>
            <span className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-mono">{code}</span>
              <span className="text-amber-400 tabular-nums">{elapsed}</span>
            </span>
          </div>
          <QualityChip quality={quality} />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-1.5 max-[380px]:gap-1 border-t border-white/10 bg-neutral-900/95 px-2 py-2 sm:static sm:mx-auto sm:border-0 sm:bg-transparent sm:p-0 xl:absolute xl:inset-x-auto xl:top-1/2 xl:bottom-auto xl:left-1/2 xl:mx-0 xl:-translate-x-1/2 xl:-translate-y-1/2">
          <DeviceButton
            on={micOn}
            onToggle={toggleMic}
            iconOn={<Mic className="size-5" />}
            iconOff={<MicOff className="size-5" />}
            labelOn={t.micOn}
            labelOff={t.micOff}
            disabled={blocked}
            meter={micOn ? level : 0}
            menuLabel={t.devices}
            groups={[
              { label: t.mic, items: devices.audioinput, value: micId, onChange: (id) => { setMicId(id); void startMedia(id, camId); } },
              { label: t.speaker, items: devices.audiooutput, value: speakerId, onChange: setSpeakerId },
            ]}
          />
          <DeviceButton
            on={camOn}
            onToggle={toggleCam}
            iconOn={<Video className="size-5" />}
            iconOff={<VideoOff className="size-5" />}
            labelOn={t.cameraOn}
            labelOff={t.cameraOff}
            disabled={blocked}
            menuLabel={t.devices}
            groups={canFlip ? [] : [{ label: t.camera, items: devices.videoinput, value: camId, onChange: (id) => { setCamId(id); void startMedia(micId, id); } }]}
          />
          {touch
            ? null
            : backgroundMenu(
                <ToolButton label={t.bg} active={background.kind !== "none"} disabled={blocked || !camOn} className="hidden sm:inline-flex">
                  {backgroundBusy ? <Loader2 className="size-5 animate-spin" /> : <WandSparkles className="size-5" />}
                </ToolButton>,
              )}
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              pickImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {canShare ? (
            sharer === "me" ? (
              <ToolButton active label={t.stopShare} onClick={stopShare} className="hidden bg-sky-500 text-white hover:bg-sky-600 sm:inline-flex">
                <MonitorX className="size-5" />
              </ToolButton>
            ) : someoneElseSharing && role === "host" ? (
              <ToolButton label={t.takeOver} onClick={() => void startShare()} className="hidden sm:inline-flex">
                <MonitorUp className="size-5" />
              </ToolButton>
            ) : (
              <ToolButton label={someoneElseSharing ? t.sharingBy.replace("{name}", sharerName) : t.share} onClick={() => void startShare()} disabled={someoneElseSharing} className="hidden sm:inline-flex">
                <MonitorUp className="size-5" />
              </ToolButton>
            )
          ) : null}
          <div className="relative">
            <ToolButton label={panel === "chat" ? t.chat : unread > 0 ? t.unread.replace("{count}", String(unread)) : t.chat} active={panel === "chat"} onClick={() => openPanel("chat")} badge={unread}>
              <MessageSquare className="size-5" />
            </ToolButton>
            {preview ? (
              <button
                type="button"
                onClick={() => openPanel("chat")}
                className="absolute bottom-full left-1/2 z-40 mb-3 w-72 -translate-x-1/2 animate-in fade-in-0 zoom-in-95 rounded-2xl bg-white p-3 text-left text-neutral-900 shadow-2xl sm:top-full sm:bottom-auto sm:mt-3 sm:mb-0"
              >
                <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-white sm:-top-1.5 sm:bottom-auto" />
                <span className="relative flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">{initials(preview.author)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                      <span className="truncate font-semibold text-neutral-800">{preview.author}</span>
                      <span className="shrink-0 tabular-nums">{clock(preview.at)}</span>
                    </span>
                    <span className="line-clamp-2 text-sm break-words">{preview.text || preview.file?.name}</span>
                  </span>
                </span>
              </button>
            ) : null}
          </div>
          {pipSupported ? (
            <ToolButton label={pipOn ? t.pipExit : t.pip} active={pipOn} disabled={!pipStream} onClick={() => void togglePip()}>
              <PictureInPicture2 className="size-5" />
            </ToolButton>
          ) : null}
          {role === "host" ? (
            <ToolButton label={t.notes} active={panel === "notes"} onClick={() => openPanel("notes")}>
              <NotebookPen className="size-5" />
            </ToolButton>
          ) : null}
          <Popover>
            <PopoverTrigger render={<ToolButton label={t.invite}><UserPlus className="size-5" /></ToolButton>} />
            <PopoverContent className="dark w-80 border-white/10 bg-neutral-900 text-neutral-100" sideOffset={8}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="size-4 text-sky-400" />
                  {t.invite}
                </div>
                <p className="text-xs text-neutral-400">{t.inviteHint}</p>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{inviteUrl(code, inviteBase).replace(/^https?:\/\/[^/]+/, "…")}</span>
                  <Button size="xs" variant="secondary" onClick={() => void copyInvite()}>
                    <Copy className="size-3" />
                    {all.tenants.copy}
                  </Button>
                </div>
                {role === "host" ? (
                  <div className="flex flex-col gap-2 border-t border-white/10 pt-3 text-sm">
                    <label className="flex items-center justify-between gap-3">
                      {t.approveJoin}
                      <Switch checked={room.approveJoin} onCheckedChange={(value) => setSetting({ approveJoin: value })} />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      {t.guestShare}
                      <Switch checked={room.guestShare} onCheckedChange={(value) => setSetting({ guestShare: value })} />
                    </label>
                  </div>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
          <span className="mx-1 h-7 w-px bg-white/10 max-[380px]:hidden" />
          {role === "host" ? (
            <Button className="h-10 gap-2 rounded-full bg-red-600 px-4 text-white hover:bg-red-700" onClick={() => setConfirm({ message: t.endConfirm, label: t.end, action: endForAll })} title={t.end}>
              <PhoneOff className="size-5" />
              <span className="hidden md:inline">{t.end}</span>
            </Button>
          ) : (
            <Button className="h-10 gap-2 rounded-full bg-red-600 px-4 text-white hover:bg-red-700" onClick={() => setConfirm({ message: t.leaveConfirm, label: t.leave, action: finish })} title={t.leave}>
              <PhoneOff className="size-5" />
              <span className="hidden md:inline">{t.leave}</span>
            </Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-neutral-400 sm:hidden">
            <span className="font-mono">{code}</span>
            <span className="text-amber-400 tabular-nums">{elapsed}</span>
          </span>
          <div className="hidden items-center rounded-full bg-white/10 p-0.5 sm:flex" role="group" aria-label={t.view}>
            {(
              [
                { key: "grid", icon: <LayoutGrid className="size-4" />, label: t.viewGrid },
                { key: "focus", icon: <LayoutPanelLeft className="size-4" />, label: t.viewFocus },
                { key: "speaker", icon: <UserRound className="size-4" />, label: t.viewSpeaker },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setView(option.key)}
                title={option.label}
                aria-label={option.label}
                aria-pressed={view === option.key}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors", view === option.key ? "bg-white text-neutral-900" : "text-neutral-300 hover:text-white")}
              >
                {option.icon}
                <span className="hidden 2xl:inline">{option.label}</span>
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-2 text-xs text-neutral-400 lg:flex">
            <span className="flex -space-x-2">
              {[{ peerId: "me", name: me }, ...peers].slice(0, 4).map((person) => (
                <span key={person.peerId} className="flex size-7 items-center justify-center rounded-full border-2 border-neutral-900 text-[10px] font-semibold text-white" style={{ background: `hsl(${hueOf(person.name)} 55% 42%)` }} title={person.name}>
                  {initials(person.name)}
                </span>
              ))}
            </span>
            {peers.length + 1}
          </div>
        </div>
      </header>

      {!room.online ? (
        <div className="absolute top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 shadow-lg">
          <Loader2 className="size-4 animate-spin" />
          {t.reconnecting}
        </div>
      ) : audioBlocked ? (
        <button type="button" onClick={unlockAudio} className="absolute top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-sky-700">
          <Volume2 className="size-4" />
          {t.unlockAudio}
        </button>
      ) : null}

      {role === "host" && room.knocks.length > 0 ? (
        <div className="absolute top-16 left-1/2 z-30 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
          {room.knocks.map((knock) => (
            <div key={knock.peerId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-800 p-3 shadow-2xl">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-300">{initials(knock.name)}</span>
              <span className="min-w-0 flex-1 text-sm">{t.knock.replace("{name}", knock.name)}</span>
              <Button size="sm" variant="ghost" className="text-neutral-300" onClick={() => void client.admit(knock.peerId, false)}>
                {t.deny}
              </Button>
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void client.admit(knock.peerId, true)}>
                {t.admit}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 pb-16 sm:pb-0">
        <main className="relative min-w-0 flex-1 p-2 sm:p-3">
          {pipHiddenId ? <div className="hidden">{renderTile(pipHiddenId, true)}</div> : null}
          {peers.length === 0 && !sharer ? (
            <div className="flex h-full flex-col gap-2 sm:gap-3 lg:flex-row">
              <div className="min-h-0 flex-1">{renderTile("me", false)}</div>
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-neutral-900/60 ring-1 ring-white/5">
                <div className="flex max-w-sm flex-col items-center gap-3 p-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-neutral-300">
                    <Users className="size-7" />
                  </span>
                  <h2 className="text-lg font-semibold">{role === "host" ? t.alone : t.waitingOthers}</h2>
                  <p className="text-sm text-neutral-400">{role === "host" ? t.aloneHint : t.waitingOthersHint}</p>
                  {role === "host" ? (
                    <div className="mt-1 flex flex-wrap justify-center gap-2">
                      <Button variant="secondary" onClick={() => void copyInvite()}>
                        <Copy className="size-4" />
                        {all.live.copyLink}
                      </Button>
                      <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setConfirm({ message: t.endConfirm, label: t.end, action: endForAll })}>
                        <PhoneOff className="size-4" />
                        {t.end}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : sharer ? (
            <div className="flex h-full flex-col gap-2 lg:flex-row">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                {sharer === "me" ? <video ref={attachScreen} autoPlay muted playsInline className="invisible size-full object-contain" /> : <StreamVideo stream={sharerPeer?.screen ?? null} muted className="size-full object-contain" />}
                {sharer === "me" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                      <MonitorUp className="size-7" />
                    </span>
                    <p className="text-lg font-semibold">{t.presenting}</p>
                    <p className="max-w-sm text-sm text-neutral-400">{t.presentingHint}</p>
                    <Button className="bg-red-600 text-white hover:bg-red-700" onClick={stopShare}>
                      <MonitorX className="size-4" />
                      {t.stopShare}
                    </Button>
                  </div>
                ) : null}
                <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium">
                  <MonitorUp className="size-3.5 text-sky-400" />
                  {t.sharingBy.replace("{name}", sharerName)}
                </span>
              </div>
              <div className={cn("flex shrink-0 gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto", view === "speaker" && "h-0 w-0 overflow-hidden lg:w-0")}>
                {layoutTiles.map((id) => (
                  <div key={id} className="aspect-video w-40 shrink-0 lg:w-full">
                    {renderTile(id, true)}
                  </div>
                ))}
              </div>
            </div>
          ) : view === "grid" ? (
            <div className={cn("grid h-full auto-rows-fr gap-2 sm:gap-3", GRID_COLUMNS[Math.min(layoutTiles.length, 12)], layoutTiles.length > 4 && "auto-rows-[minmax(7rem,1fr)] overflow-y-auto")}>
              {layoutTiles.map((id) => (
                <div key={id} className="min-h-0">
                  {renderTile(id, false)}
                </div>
              ))}
            </div>
          ) : view === "focus" ? (
            <div className="flex h-full flex-col gap-2 lg:flex-row">
              <div className="min-h-0 flex-1">{renderTile(layoutFocus, false)}</div>
              <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto">
                {layoutTiles
                  .filter((id) => id !== layoutFocus)
                  .map((id) => (
                    <div key={id} className="aspect-video w-40 shrink-0 lg:w-full">
                      {renderTile(id, true)}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="relative h-full">
              {renderTile(layoutFocus, false)}
              {cornerId ? <div className="absolute right-3 bottom-3 z-10 aspect-video w-32 shadow-2xl sm:w-48">{renderTile(cornerId, true)}</div> : null}
              <div className="hidden">
                {layoutTiles
                  .filter((id) => id !== layoutFocus && id !== cornerId)
                  .map((id) => (
                    <div key={id}>{renderTile(id, true)}</div>
                  ))}
              </div>
            </div>
          )}

          {room.hostLost && role === "guest" ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-neutral-900 p-6 text-center ring-1 ring-white/10">
                <Loader2 className="size-8 animate-spin text-amber-400" />
                <p className="font-medium">{t.hostLost}</p>
              </div>
            </div>
          ) : null}
        </main>

        {panel ? (
          <aside
            className="fixed inset-x-0 top-14 bottom-16 z-20 flex flex-col border-white/10 bg-neutral-900 sm:relative sm:inset-auto sm:z-auto sm:w-80 sm:border-l lg:w-96"
            onDragOver={(event) => {
              if (panel !== "chat" || !event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(event) => {
              if (panel !== "chat") return;
              event.preventDefault();
              setDragging(false);
              void sendFiles([...event.dataTransfer.files]);
            }}
          >
            {dragging && panel === "chat" ? (
              <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-400 bg-neutral-900/90 text-sm text-sky-200">
                <Paperclip className="size-6" />
                {t.dropFiles}
              </div>
            ) : null}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                {panel === "chat" ? <MessageSquare className="size-4" /> : <NotebookPen className="size-4" />}
                {panel === "chat" ? t.chat : t.notes}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => setPanel(null)} aria-label={all.common.close} title={all.common.close}>
                <X className="size-4" />
              </Button>
            </div>
            {panel === "chat" ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                  {room.messages.map((entry) => {
                    const own = mine(entry);
                    const isImage = Boolean(entry.file && isImageFile(entry.file.url));
                    return (
                      <div key={entry.id} className={cn("flex max-w-[85%] flex-col gap-0.5", own ? "items-end self-end" : "self-start")}>
                        <span className="px-1 text-[11px] text-neutral-500">
                          {own ? t.you : entry.author} · {clock(entry.at)}
                          {isImage && entry.file ? ` · ${formatBytes(entry.file.size)}` : ""}
                        </span>
                        {entry.text ? (
                          <span className={cn("rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap", own ? "rounded-br-sm bg-sky-600 text-white" : "rounded-bl-sm bg-white/10")}>
                            <LinkedText text={entry.text} />
                          </span>
                        ) : null}
                        {isImage && entry.file ? (
                          <a href={entry.file.url} target="_blank" rel="noreferrer" className="block w-fit overflow-hidden rounded-xl hover:opacity-90" title={entry.file.name}>
                            <Image src={entry.file.url} alt={entry.file.name} width={480} height={320} unoptimized className="h-auto max-h-56 w-auto max-w-full object-contain" onLoad={() => chatEnd.current?.scrollIntoView({ block: "end" })} />
                          </a>
                        ) : null}
                        {entry.file && !isImage ? (
                          <a href={entry.file.url} target="_blank" rel="noreferrer" className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:opacity-90", own ? "bg-sky-700 text-white" : "bg-white/10")}>
                            <FileIcon name={entry.file.name} />
                            <span className="min-w-0 truncate">{entry.file.name}</span>
                            <span className="shrink-0 text-xs opacity-70">{formatBytes(entry.file.size)}</span>
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                  <div ref={chatEnd} />
                </div>
                <form
                  className="flex items-end gap-1.5 border-t border-white/10 p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                >
                  <Button type="button" variant="ghost" size="icon" aria-label={t.attach} title={t.attach} className="text-neutral-400" onClick={() => fileRef.current?.click()} disabled={sending}>
                    <Paperclip className="size-4" />
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={LIVE_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
                    className="hidden"
                    onChange={(event) => {
                      void sendFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <Textarea
                    rows={1}
                    value={draft}
                    maxLength={2000}
                    placeholder={t.messagePlaceholder}
                    className="max-h-28 min-h-9 flex-1 resize-none border-white/10 bg-black/30"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim() || sending} aria-label={t.send} title={t.send} className="bg-sky-600 text-white hover:bg-sky-700">
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                <p className="flex items-start gap-1.5 rounded-md bg-sky-500/10 px-2.5 py-2 text-xs text-sky-300">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  {t.notesPrivate}
                </p>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={all.live.hostNotesPlaceholder} className="min-h-0 flex-1 resize-none border-white/10 bg-black/30" />
                <span className="h-4 text-right text-[11px] text-neutral-500">{notesState === "saving" ? t.saving : notesState === "saved" ? t.saved : ""}</span>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-neutral-900 p-5 ring-1 ring-white/10">
            <p className="text-sm">{confirm.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {all.common.cancel}
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  const action = confirm.action;
                  setConfirm(null);
                  action();
                }}
              >
                <LogOut className="size-4" />
                {confirm.label}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {renaming !== null ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-neutral-900 p-5 ring-1 ring-white/10"
            onSubmit={(event) => {
              event.preventDefault();
              saveName();
            }}
          >
            <label htmlFor="live-rename" className="text-sm font-medium">
              {t.renameTitle}
            </label>
            <Input id="live-rename" autoFocus maxLength={60} value={renaming} onChange={(event) => setRenaming(event.target.value)} className="h-10 border-white/15 bg-black/30" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                {all.common.cancel}
              </Button>
              <Button type="submit" disabled={!renaming.trim()} className="bg-sky-600 text-white hover:bg-sky-700">
                {all.common.save}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function PipVideo({ videoRef, stream, onChange }: { videoRef: React.RefObject<HTMLVideoElement | null>; stream: MediaStream | null; onChange: (on: boolean) => void }) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const enter = () => onChange(true);
    const leave = () => onChange(false);
    video.addEventListener("enterpictureinpicture", enter);
    video.addEventListener("leavepictureinpicture", leave);
    const action = "enterpictureinpicture" as string as MediaSessionAction;
    try {
      navigator.mediaSession?.setActionHandler(action, () => {
        if (video.srcObject && !document.pictureInPictureElement) void video.requestPictureInPicture().catch(() => undefined);
      });
    } catch {
      void 0;
    }
    return () => {
      video.removeEventListener("enterpictureinpicture", enter);
      video.removeEventListener("leavepictureinpicture", leave);
      try {
        navigator.mediaSession?.setActionHandler(action, null);
      } catch {
        void 0;
      }
      if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => undefined);
    };
  }, [videoRef, onChange]);
  useEffect(() => {
    const element = videoRef.current;
    if (!element || element.srcObject === stream) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => undefined);
  }, [videoRef, stream]);
  return <video ref={videoRef} autoPlay playsInline muted aria-hidden className="pointer-events-none fixed top-0 left-0 size-px opacity-0" />;
}

function StreamVideo({ stream, muted, className, sinkId, onBlocked }: { stream: MediaStream | null; muted?: boolean; className?: string; sinkId?: string; onBlocked?: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream;
    if (stream) void element.play().catch(() => onBlocked?.());
  }, [stream, onBlocked]);
  useEffect(() => {
    const element = ref.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (element?.setSinkId && sinkId) void element.setSinkId(sinkId).catch(() => undefined);
  }, [sinkId]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function QualityChip({ quality }: { quality: Quality }) {
  const t = useI18n().messages.live.room;
  const Icon = quality === "good" ? SignalHigh : quality === "weak" ? SignalLow : SignalZero;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        quality === "good" ? "bg-emerald-500/15 text-emerald-400" : quality === "weak" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-400",
      )}
      title={t.quality[quality]}
    >
      <Icon className="size-3.5" />
      <span className="hidden md:inline">{t.quality[quality]}</span>
    </span>
  );
}

function ToolButton({ label, active, badge, className, children, ...rest }: React.ComponentProps<"button"> & { label: string; active?: boolean; badge?: number }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-white text-neutral-900" : "bg-white/10 text-neutral-100 hover:bg-white/20",
        className,
      )}
    >
      {children}
      {badge && badge > 0 ? <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-5 font-semibold text-white tabular-nums">{badge}</span> : null}
    </button>
  );
}

type DeviceGroup = { label: string; items: MediaDeviceInfo[]; value: string; onChange: (id: string) => void };

function DeviceButton({
  on,
  onToggle,
  iconOn,
  iconOff,
  labelOn,
  labelOff,
  disabled,
  meter,
  menuLabel,
  groups,
}: {
  on: boolean;
  onToggle: () => void;
  iconOn: ReactNode;
  iconOff: ReactNode;
  labelOn: string;
  labelOff: string;
  disabled?: boolean;
  meter?: number;
  menuLabel: string;
  groups: DeviceGroup[];
}) {
  return (
    <div className={cn("flex items-center rounded-full", on ? "bg-white/10" : "bg-red-500/90")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title={on ? labelOn : labelOff}
        aria-label={on ? labelOn : labelOff}
        className="relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full text-white hover:bg-white/10 disabled:opacity-40"
      >
        {meter !== undefined && on ? <span className="absolute inset-x-0 bottom-0 bg-emerald-400/40 transition-[height] duration-75" style={{ height: `${Math.round(meter * 100)}%` }} /> : null}
        <span className="relative">{on ? iconOn : iconOff}</span>
      </button>
      {groups.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" title={menuLabel} aria-label={menuLabel} className="inline-flex h-10 w-6 items-center justify-center rounded-r-full text-white/80 hover:bg-white/10 max-[380px]:hidden">
                <ChevronUp className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent className="dark w-[26rem] max-w-[calc(100vw-1rem)] border-white/10 bg-neutral-900 text-neutral-100" side="bottom" align="center">
            {groups.map((group, index) => (
              <DropdownMenuGroup key={group.label}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.items.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-neutral-500">—</div>
                ) : (
                  <DropdownMenuRadioGroup value={group.value} onValueChange={(value) => group.onChange(String(value))}>
                    {group.items.map((item, itemIndex) => (
                      <DropdownMenuRadioItem key={item.deviceId || itemIndex} value={item.deviceId} title={item.label || undefined}>
                        <span className="min-w-0 flex-1 truncate">{item.label || `${group.label} ${itemIndex + 1}`}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function NameTag({ name, muted, compact }: { name: string; muted: boolean; compact?: boolean }) {
  return (
    <span className={cn("flex items-center rounded-md bg-black/60 font-medium backdrop-blur", compact ? "min-w-0 gap-1 px-1.5 py-0.5 text-[10px]" : "absolute bottom-2 left-2 max-w-[calc(100%-1rem)] gap-1.5 px-2 py-1 text-xs")} title={name}>
      {muted ? <MicOff className={cn("shrink-0 text-red-400", compact ? "size-3" : "size-3.5")} /> : <Mic className={cn("shrink-0 text-emerald-400", compact ? "size-3" : "size-3.5")} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

function SelfTile({
  videoRef,
  name,
  camOn,
  mirror,
  micOn,
  blocked,
  level,
  small,
  youLabel,
  blockedText,
  host,
  hostLabel,
}: {
  videoRef: (element: HTMLVideoElement | null) => void;
  name: string;
  camOn: boolean;
  mirror: boolean;
  micOn: boolean;
  blocked: boolean;
  level: number;
  small?: boolean;
  youLabel: string;
  blockedText: string;
  host?: boolean;
  hostLabel: string;
}) {
  const speaking = micOn && level > 0.15;
  return (
    <div className={cn("relative size-full overflow-hidden rounded-xl bg-neutral-800 ring-2 transition-shadow", speaking ? "ring-emerald-400" : "ring-white/5")}>
      <video ref={videoRef} autoPlay muted playsInline className={cn("size-full object-cover", mirror ? "-scale-x-100" : "", camOn ? "" : "invisible")} />
      {!camOn ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-800 to-neutral-900 p-3 text-center">
          <span className={cn("flex items-center justify-center rounded-full bg-sky-700 font-semibold text-white", small ? "size-10 text-sm" : "size-20 text-2xl")}>{initials(name)}</span>
          {blocked && !small ? <p className="max-w-xs text-xs text-amber-300">{blockedText}</p> : null}
        </div>
      ) : null}
      {host ? <HostStar label={hostLabel} small={small} /> : null}
      {small ? null : <NameTag name={name === youLabel ? name : `${name} (${youLabel})`} muted={!micOn} />}
    </div>
  );
}

function HostStar({ label, small }: { label: string; small?: boolean }) {
  return (
    <span className={cn("absolute top-2 right-2 z-10 flex items-center justify-center rounded-full bg-black/55 shadow-lg ring-1 ring-amber-300/40 backdrop-blur", small ? "size-6" : "size-8")} title={label} aria-label={label}>
      <Star className={cn("fill-amber-400 text-amber-400", small ? "size-3.5" : "size-4.5")} />
    </span>
  );
}

function PeerTile({ peer, small, hostLost, speakerId, onAudioBlocked, t }: { peer: RemotePeer; small?: boolean; hostLost: boolean; speakerId: string; onAudioBlocked: () => void; t: RoomText }) {
  const lost = peer.rtc === "reconnecting" || (hostLost && peer.role === "host");
  const failed = peer.rtc === "failed";
  const hue = hueOf(peer.name);
  const hasVideo = peer.camera && peer.rtc === "connected" && Boolean(peer.stream?.getVideoTracks().length);
  return (
    <div className={cn("relative size-full overflow-hidden rounded-xl ring-2 transition-shadow", peer.speaking && !lost ? "ring-emerald-400" : "ring-white/5")} style={{ background: `radial-gradient(circle at 30% 20%, hsl(${hue} 45% 32%), hsl(${hue} 35% 12%))` }}>
      <StreamVideo stream={peer.stream} sinkId={speakerId} onBlocked={onAudioBlocked} className={cn("absolute inset-0 size-full object-cover", hasVideo ? "" : "invisible")} />
      {!hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("flex items-center justify-center rounded-full font-semibold text-white shadow-lg", small ? "size-10 text-sm" : "size-24 text-3xl", peer.speaking && !lost ? "ring-4 ring-emerald-400/50" : "")} style={{ background: `hsl(${hue} 55% 42%)` }}>
            {initials(peer.name)}
          </span>
        </div>
      ) : null}
      {peer.role === "host" ? <HostStar label={t.host} small={small} /> : null}
      {!peer.camera && !small ? (
        <span className={cn("absolute top-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] text-neutral-300", peer.role === "host" ? "right-12" : "right-2")}>
          <VideoOff className="size-3.5" />
          {t.cameraOffLabel}
        </span>
      ) : null}
      {peer.rtc === "connecting" && !small ? (
        <span className="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-neutral-200">
          <Loader2 className="size-3.5 animate-spin" />
          {t.connecting}
        </span>
      ) : null}
      {lost || failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 p-3 text-center backdrop-blur-[2px]">
          {failed ? <WifiOff className={cn("text-red-400", small ? "size-5" : "size-8")} /> : <Loader2 className={cn("animate-spin text-amber-400", small ? "size-5" : "size-8")} />}
          {!small ? <span className="text-sm font-medium">{failed ? t.peerFailed : peer.role === "host" && hostLost ? t.hostLost : t.reconnecting}</span> : null}
        </div>
      ) : null}
      {small ? null : <NameTag name={peer.name} muted={peer.muted} />}
    </div>
  );
}
