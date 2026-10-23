"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Bell, BellRing, CalendarClock, Check, ChevronsUpDown, Copy, Download, ExternalLink, MessageSquare, PhoneCall, EyeOff, Loader2, Palette, PhoneIncoming, PhoneOff, RefreshCw, Users, Video, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { AdminHeader } from "@/components/panel/admin-header";
import { ConfirmProvider, useConfirm } from "@/components/panel/confirm-dialog";
import { HeaderDateRange, HeaderSelect, HeaderText } from "@/components/panel/header-filters";
import { inviteUrl } from "@/components/live/invite";
import { LiveSessionDialog, STATUS_COLOR, StatusPill } from "@/components/live/session-dialog";
import { enablePush } from "@/components/live/push";
import { AppearanceDialog } from "@/components/live/appearance-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, authHeaders, BASE_PATH, sessionExpired, storeToken, subscribeToken, tokenState } from "@/lib/admin-client";
import { excelDate, writeExcel, type ExcelCell } from "@/lib/excel";
import { formatDate, formatDateTime } from "@/lib/format";
import { durationMinutes, emptyAppearance, initials, isReminderDue, LIVE_STATUSES, liveBadgeCount, type LiveSession, type LiveSessionPatch, type LiveSettings } from "@/lib/live";
import { cn } from "@/lib/utils";

type SiteMode = "hidden" | "available" | "request";

const SITE_MODES: SiteMode[] = ["hidden", "available", "request"];

type TextFilters = { code: string; name: string; phone: string; email: string };
type SessionSort = "createdAt" | "code" | "name" | "phone" | "email" | "status" | "duration" | "participants" | "reminder";
type SortDir = "asc" | "desc";

function guestCount(item: LiveSession): number {
  return new Set(item.participants.filter((entry) => entry.role === "guest").map((entry) => entry.name)).size;
}

function sortValue(item: LiveSession, key: SessionSort): string | number {
  if (key === "createdAt") return item.createdAt;
  if (key === "code") return item.inviteCode;
  if (key === "name") return item.name;
  if (key === "phone") return item.phone;
  if (key === "email") return item.email;
  if (key === "status") return LIVE_STATUSES.indexOf(item.status);
  if (key === "duration") return durationMinutes(item) ?? -1;
  if (key === "participants") return guestCount(item);
  return item.reminderAt ?? "";
}

type AudioCtor = typeof AudioContext;

const SOUND_KEY = "erenler_live_sound";
const RECONNECT_MS = 3000;
const RING: [number, number][] = [
  [0, 880],
  [0.25, 880],
  [0.9, 880],
  [1.15, 880],
  [1.8, 880],
  [2.05, 880],
];
const BEEP: [number, number][] = [[0, 1000]];

function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function storeSoundPref(value: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, value ? "on" : "off");
  } catch {
    return;
  }
}

function beep(ctx: AudioContext, at: number, frequency: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.22);
}

let sharedAudio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (sharedAudio) return sharedAudio;
  const Ctor: AudioCtor | undefined = window.AudioContext || (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedAudio = new Ctor();
  } catch {
    sharedAudio = null;
  }
  return sharedAudio;
}

function audioReady(): boolean {
  return audioContext()?.state === "running";
}

function unlockSound(): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === "running") return Promise.resolve(true);
  return ctx.resume().then(
    () => ctx.state === "running",
    () => false,
  );
}

function playPattern(pattern: [number, number][]): void {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime + 0.05;
    for (const [offset, frequency] of pattern) beep(ctx, start + offset, frequency);
  } catch {
    return;
  }
}

function desktopNotify(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const note = new Notification(title, { body });
  note.onclick = () => {
    window.focus();
    note.close();
  };
}

async function readEvents(body: NonNullable<Response["body"]>, onEvent: (name: string, data: unknown) => void): Promise<void> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let name = "message";
  let data: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end = buffer.indexOf("\n");
    while (end >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      end = buffer.indexOf("\n");
      if (line === "") {
        if (data.length > 0) onEvent(name, JSON.parse(data.join("\n")));
        name = "message";
        data = [];
      } else if (line.startsWith("event:")) {
        name = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      }
    }
  }
}

export default function LivePage() {
  return (
    <ConfirmProvider>
      <LiveScreen />
    </ConfirmProvider>
  );
}

function LiveScreen() {
  const signedIn = useSyncExternalStore(subscribeToken, tokenState, () => null);

  useEffect(() => {
    if (signedIn === false) window.location.replace(BASE_PATH);
  }, [signedIn]);

  function signOut() {
    storeToken(null);
    window.location.replace(BASE_PATH);
  }

  if (!signedIn) return null;
  return <LiveManager onSignOut={signOut} />;
}

function LiveManager({ onSignOut }: { onSignOut: () => void }) {
  const { messages: t, locale } = useI18n();
  const confirm = useConfirm();
  const [items, setItems] = useState<LiveSession[]>([]);
  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [inCall, setInCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [hostDraft, setHostDraft] = useState<string | null>(null);
  const [inviteDraft, setInviteDraft] = useState<string | null>(null);
  const [soundReady, setSoundReady] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [sound, setSound] = useState(readSoundPref);
  const [notify, setNotify] = useState<NotificationPermission | "unsupported">(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const [tab, setTab] = useState<"all" | "reminders">("all");
  const [sort, setSort] = useState<SessionSort>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<TextFilters>({ code: "", name: "", phone: "", email: "" });
  const [statusFilter, setStatusFilter] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [reminderDates, setReminderDates] = useState({ from: "", to: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const soundRef = useRef(sound);
  const eventRef = useRef<(name: string, payload: unknown) => void>(() => undefined);
  const reloadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const available = settings?.available ?? false;
  const visibility = settings?.visibility ?? "always";
  const mode: SiteMode = visibility === "hidden" || (visibility === "available" && !available) ? "hidden" : available ? "available" : "request";
  const siteState = mode === "hidden" ? t.live.siteHidden : mode === "available" ? (inCall ? t.live.siteBusy : t.live.availableOn) : t.live.availableOff;
  const waiting = items.filter((item) => item.status === "waiting");
  const callbacks = items.filter((item) => item.status === "request" || (item.isNew && item.status === "missed"));
  const reminders = items.filter((item) => isReminderDue(item));
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const source = tab === "reminders" ? items.filter((item) => item.reminderAt && !item.reminderDone) : items.filter((item) => item.status !== "waiting");
    const match = (value: string, query: string) => value.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"));
    const rows = source.filter((item) => {
      if (filters.code && !item.inviteCode.replace(/-/g, "").toLocaleLowerCase("tr").includes(filters.code.replace(/-/g, "").trim().toLocaleLowerCase("tr"))) return false;
      if (filters.name && !match(item.name, filters.name)) return false;
      if (filters.phone && !item.phone.replace(/\D/g, "").includes(filters.phone.replace(/\D/g, ""))) return false;
      if (filters.email && !match(item.email, filters.email)) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      const day = item.createdAt.slice(0, 10);
      if (dates.from && day < dates.from) return false;
      if (dates.to && day > dates.to) return false;
      const reminderDay = item.reminderAt?.slice(0, 10) ?? "";
      if ((reminderDates.from || reminderDates.to) && !reminderDay) return false;
      if (reminderDates.from && reminderDay < reminderDates.from) return false;
      if (reminderDates.to && reminderDay > reminderDates.to) return false;
      return true;
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const left = sortValue(a, sort);
      const right = sortValue(b, sort);
      if (left === "" && right !== "") return 1;
      if (right === "" && left !== "") return -1;
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "tr", { numeric: true, sensitivity: "base" });
      return result * direction;
    });
  }, [items, tab, filters, statusFilter, dates, reminderDates, sort, sortDir]);

  function toggleSort(key: SessionSort) {
    if (sort === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  }

  function sortHead(key: SessionSort, label: string, className?: string) {
    const active = sort === key;
    return (
      <TableHead className={className} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground" onClick={() => toggleSort(key)}>
          {label}
          {active ? sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
        </button>
      </TableHead>
    );
  }

  const statusOptions = LIVE_STATUSES.filter((status) => status !== "waiting").map((status) => ({ value: status, label: t.live.statuses[status], color: STATUS_COLOR[status] }));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const waitingCount = waiting.length;
  useEffect(() => {
    const base = document.title;
    if (waitingCount === 0) return;
    const label = `(${waitingCount}) ${t.live.incomingTitle}`;
    let on = false;
    const tick = () => {
      on = !on;
      document.title = document.hidden && on ? label : base;
    };
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (!document.hidden) document.title = base;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      document.title = base;
    };
  }, [waitingCount, t.live.incomingTitle]);

  function upsert(session: LiveSession) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === session.id);
      if (index < 0) return [session, ...current];
      const next = [...current];
      next[index] = session;
      return next;
    });
  }

  async function refresh() {
    setLoading(true);
    await Promise.all([reload(), new Promise((resolve) => setTimeout(resolve, 400))]);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const date = (value: string | null): ExcelCell => (value ? (excelDate(value) ?? value) : "");
      await writeExcel({
        fileName: `gorusmeler-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: t.live.title,
        header: [t.live.date, t.live.code, t.live.name, t.live.phone, t.live.email, t.live.status, t.live.duration, t.live.participants, t.live.reminder, t.live.note, t.live.page],
        rows: filtered.map((item) => [date(item.createdAt), item.inviteCode, item.name, item.phone, item.email, t.live.statuses[item.status], durationMinutes(item) ?? "", guestCount(item) || "", date(item.reminderAt), item.note, item.page]),
      });
    } catch {
      toast.error(t.live.actionFailed);
    } finally {
      setExporting(false);
    }
  }

  async function reload() {
    try {
      const [sessions, current] = await Promise.all([adminFetch<LiveSession[]>("/live/sessions"), adminFetch<LiveSettings & { busy?: boolean }>("/live/settings")]);
      setInCall(current.busy === true);
      seenRef.current = new Set(sessions.map((session) => session.id));
      loadedRef.current = true;
      setItems(sessions);
      setSettings(current);
    } catch {
      toast.error(t.live.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  function announce(session: LiveSession) {
    if (session.status === "waiting") {
      if (soundRef.current) playPattern(RING);
      desktopNotify(t.live.incomingTitle, session.name || t.live.anonymous);
    } else if (session.status === "request") {
      playPattern(BEEP);
      desktopNotify(t.live.callbackTitle, [session.name, session.phone].filter(Boolean).join(" · ") || t.live.anonymous);
    }
  }

  function handleEvent(name: string, payload: unknown) {
    if (name === "session") {
      const session = payload as LiveSession;
      const fresh = !seenRef.current.has(session.id);
      seenRef.current.add(session.id);
      upsert(session);
      if (fresh && loadedRef.current) announce(session);
    } else if (name === "settings") {
      setSettings(payload as LiveSettings);
    } else if (name === "busy") {
      setInCall((payload as { busy?: boolean }).busy === true);
    }
  }

  useEffect(() => {
    eventRef.current = handleEvent;
    reloadRef.current = reload;
  });

  useEffect(() => {
    void reloadRef.current();
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: number | undefined;
    let attempt = 0;

    const connect = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(`${BASE_PATH}/api/live/events`, {
          headers: { ...authHeaders(), Accept: "text/event-stream" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          sessionExpired();
          return;
        }
        if (!response.ok || !response.body) throw new Error("stream");
        if (attempt > 0) void reloadRef.current();
        attempt += 1;
        await readEvents(response.body, (name, data) => eventRef.current(name, data));
      } catch {
        if (stopped) return;
      }
      if (!stopped) timer = window.setTimeout(() => void connect(), RECONNECT_MS);
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(timer);
    };
  }, []);

  async function setMode(next: SiteMode) {
    const body = next === "hidden" ? { available: false, visibility: "hidden" as const } : { available: next === "available", visibility: "always" as const };
    setSettings((current) => (current ? { ...current, ...body } : current));
    try {
      setSettings(await adminFetch<LiveSettings>("/live/settings", { method: "PUT", body }));
    } catch {
      toast.error(t.live.saveFailed);
      void reload();
    }
  }

  async function saveHostName() {
    const value = (hostDraft ?? "").trim();
    if (!value) return;
    try {
      setSettings(await adminFetch<LiveSettings>("/live/settings", { method: "PUT", body: { hostName: value } }));
      setHostDraft(null);
      toast.success(t.live.hostNameSaved);
    } catch {
      toast.error(t.live.saveFailed);
    }
  }

  async function saveInviteBase() {
    if (inviteDraft === null) return;
    try {
      await saveSettings({ inviteBase: inviteDraft.trim() });
      setInviteDraft(null);
    } catch {
      return;
    }
  }

  async function saveSettings(body: Partial<LiveSettings>) {
    try {
      setSettings(await adminFetch<LiveSettings>("/live/settings", { method: "PUT", body }));
      toast.success(t.live.settingsSaved);
    } catch {
      toast.error(t.live.saveFailed);
      throw new Error("save");
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    soundRef.current = next;
    storeSoundPref(next);
  }

  useEffect(() => {
    const unlock = () => {
      void unlockSound().then((ok) => setSoundReady(ok));
    };
    const timer = window.setTimeout(() => setSoundReady(audioReady()), 0);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  async function askNotify() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotify(permission);
    if (permission === "granted") void enablePush();
  }

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") void enablePush();
  }, []);

  function openRoom(code: string) {
    window.open(`${BASE_PATH}/live/room/${code}`, "_blank");
  }

  async function accept(item: LiveSession) {
    const ok = await confirm({ message: t.live.acceptConfirm.replace("{name}", item.name || t.live.anonymous), confirmText: t.live.accept });
    if (!ok) return;
    try {
      const session = await adminFetch<LiveSession>(`/live/sessions/${item.id}/accept`, { method: "POST" });
      upsert(session);
      openRoom(session.inviteCode);
    } catch {
      toast.error(t.live.actionFailed);
    }
  }

  async function reject(item: LiveSession) {
    const ok = await confirm({ message: t.live.rejectConfirm.replace("{name}", item.name || t.live.anonymous), confirmText: t.live.reject, danger: true });
    if (!ok) return;
    try {
      upsert(await adminFetch<LiveSession>(`/live/sessions/${item.id}/reject`, { method: "POST" }));
    } catch {
      toast.error(t.live.actionFailed);
    }
  }

  async function startSession(id: string) {
    try {
      const session = await adminFetch<LiveSession>(`/live/sessions/${id}/open`, { method: "POST" });
      upsert(session);
      openRoom(session.inviteCode);
    } catch {
      toast.error(t.live.actionFailed);
    }
  }

  async function patchSession(id: string, body: LiveSessionPatch, success?: string) {
    try {
      upsert(await adminFetch<LiveSession>(`/live/sessions/${id}`, { method: "PATCH", body }));
      if (success) toast.success(success);
    } catch {
      toast.error(t.live.saveFailed);
    }
  }

  async function removeSession(id: string) {
    try {
      await adminFetch<unknown>(`/live/sessions/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== id));
      setSelectedId(null);
      toast.success(t.live.deleted);
    } catch {
      toast.error(t.live.actionFailed);
    }
  }

  function open(item: LiveSession) {
    setSelectedId(item.id);
    if (item.isNew) void patchSession(item.id, { isNew: false });
  }

  async function copyInvite(code: string) {
    await navigator.clipboard.writeText(inviteUrl(code, settings?.inviteBase ?? ""));
    toast.success(t.live.linkCopied);
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader active="live" onSignOut={onSignOut} liveCount={liveBadgeCount(items)} />
      <main className="mx-auto flex max-w-[100rem] flex-col gap-4 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="mr-auto">
            <h2 className="text-xl font-semibold">{t.live.title}</h2>
            <p className="text-sm text-muted-foreground">{t.live.subtitle}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <Card className={cn("overflow-hidden border-2 transition-colors", available ? "border-emerald-500/50" : "border-transparent")}>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", mode === "available" ? "bg-emerald-500/15" : mode === "request" ? "bg-amber-500/15" : "bg-muted")}>
                    <span className="relative flex size-3">
                      {mode === "available" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" /> : null}
                      <span className={cn("relative inline-flex size-3 rounded-full", mode === "available" ? "bg-emerald-500" : mode === "request" ? "bg-amber-500" : "bg-muted-foreground/50")} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{t.live.siteMode}</span>
                  <Button variant="outline" size="icon-sm" disabled={!settings} onClick={() => setAppearanceOpen(true)} aria-label={t.live.appearance.open} title={t.live.appearance.open}>
                    <Palette className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={t.live.siteMode}>
                  {SITE_MODES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={mode === key}
                      disabled={!settings}
                      onClick={() => void setMode(key)}
                      className={cn(
                        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors disabled:opacity-50",
                        mode === key
                          ? key === "available"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : key === "request"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {key === "hidden" ? <EyeOff className="size-4" /> : key === "available" ? <Video className="size-4" /> : <PhoneIncoming className="size-4" />}
                      {t.live.siteModes[key]}
                    </button>
                  ))}
                </div>
                <span className="min-h-10 text-sm text-muted-foreground">{siteState}</span>
              </div>
              <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                <label htmlFor="live-host-name" className="font-medium">
                  {t.live.hostName}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="live-host-name"
                    value={hostDraft ?? settings?.hostName ?? ""}
                    disabled={!settings}
                    maxLength={60}
                    onChange={(event) => setHostDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveHostName();
                    }}
                  />
                  <Button variant="secondary" disabled={hostDraft === null || !hostDraft.trim() || hostDraft.trim() === settings?.hostName} onClick={() => void saveHostName()}>
                    {t.common.save}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">{t.live.hostNameHint}</span>
              </div>
              <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                <label htmlFor="live-invite-base" className="font-medium">
                  {t.live.inviteBase}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="live-invite-base"
                    value={inviteDraft ?? settings?.inviteBase ?? ""}
                    disabled={!settings}
                    maxLength={200}
                    placeholder={settings ? `${window.location.origin}${BASE_PATH}/live/join` : undefined}
                    onChange={(event) => setInviteDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveInviteBase();
                    }}
                  />
                  <Button variant="secondary" disabled={inviteDraft === null || inviteDraft.trim() === (settings?.inviteBase ?? "")} onClick={() => void saveInviteBase()}>
                    {t.common.save}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 border-t pt-3 text-sm">
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {notify === "granted" ? <BellRing className="size-4 shrink-0" /> : <Bell className="size-4 shrink-0" />}
                    {t.live.notifications}
                  </span>
                  {notify === "granted" ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{t.live.notificationsOn}</span>
                  ) : notify === "unsupported" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Button size="xs" variant="secondary" className="shrink-0" onClick={() => void askNotify()}>
                      {t.live.notificationsAsk}
                    </Button>
                  )}
                </div>
                {sound && !soundReady ? (
                  <button type="button" onClick={() => void unlockSound().then((ok) => setSoundReady(ok))} className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-700 dark:text-amber-300">
                    <VolumeX className="size-4 shrink-0" />
                    {t.live.soundLocked}
                  </button>
                ) : null}
                <button type="button" className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-left hover:bg-muted" onClick={toggleSound}>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {sound ? <Volume2 className="size-4 shrink-0" /> : <VolumeX className="size-4 shrink-0" />}
                    {t.live.sound}
                  </span>
                  <Switch checked={sound} aria-label={t.live.sound} className="pointer-events-none" />
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="flex min-h-36 flex-col gap-3">
            {waiting.length === 0 && callbacks.length === 0 ? (
              <Card className="flex-1 border-dashed">
                <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                    <Video className="size-5" />
                  </span>
                  {siteState}
                </CardContent>
              </Card>
            ) : (
              waiting.map((item) => {
                const seconds = Math.max(0, Math.floor((now - new Date(item.createdAt).getTime()) / 1000));
                return (
                  <Card key={item.id} className="overflow-hidden border-2 border-sky-500/60 bg-gradient-to-r from-sky-500/10 via-transparent to-transparent">
                    <CardContent className="flex flex-wrap items-center gap-4 p-4">
                      <span className="relative flex size-12 shrink-0 items-center justify-center">
                        <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/30" />
                        <span className="relative flex size-12 items-center justify-center rounded-full bg-sky-600 text-base font-semibold text-white">{item.name ? initials(item.name) : <PhoneIncoming className="size-5" />}</span>
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-400">{t.live.incomingTitle}</span>
                        <span className="truncate text-lg font-semibold">{item.name || t.live.anonymous}</span>
                        <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                          <span className="tabular-nums">{t.live.incomingWaiting.replace("{seconds}", String(seconds))}</span>
                          <span className="truncate">{t.live.incomingFrom.replace("{page}", item.page)}</span>
                          {item.phone ? <span className="tabular-nums">{item.phone}</span> : null}
                        </span>
                        {item.note ? (
                          <span className="mt-1 flex items-start gap-1.5 text-sm">
                            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                            <span className="line-clamp-2 whitespace-pre-line">{item.note}</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => void reject(item)}>
                          <PhoneOff className="size-4" />
                          {t.live.reject}
                        </Button>
                        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={inCall} title={inCall ? t.live.acceptBusy : undefined} onClick={() => void accept(item)}>
                          <Video className="size-4" />
                          {t.live.accept}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
            {callbacks.map((item) => (
              <Card key={item.id} className="overflow-hidden border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base font-semibold text-white">{item.name ? initials(item.name) : <MessageSquare className="size-5" />}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">{item.status === "missed" ? (item.phone || item.note ? t.live.callbackMissedTitle : t.live.missedTitle) : t.live.callbackTitle}</span>
                    <span className="truncate text-lg font-semibold">{item.name || t.live.anonymous}</span>
                    <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                      <span className="tabular-nums">{formatDateTime(item.createdAt, locale)}</span>
                      {item.phone ? <span className="tabular-nums">{item.phone}</span> : null}
                    </span>
                    {item.note ? <span className="mt-1 line-clamp-2 text-sm">{item.note}</span> : null}
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                    {item.status === "request" ? (
                      <Button variant="outline" onClick={() => void patchSession(item.id, { status: "completed" })}>
                        <Check className="size-4" />
                        {t.live.callbackDone}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => void patchSession(item.id, { isNew: false })}>
                        <Check className="size-4" />
                        {t.live.callbackSeen}
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => open(item)}>
                      {t.live.callbackDetail}
                    </Button>
                    {item.phone ? (
                      <Button className="bg-emerald-600 text-white hover:bg-emerald-700" render={<a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} />}>
                        <PhoneCall className="size-4" />
                        {t.live.callbackCall}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {(["all", "reminders"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {key === "reminders" ? <CalendarClock className="size-4" /> : null}
                {t.live.tabs[key]}
                {key === "reminders" && reminders.length > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">{reminders.length}</span> : null}
              </button>
            ))}
          </div>
          {reminders.length > 0 ? (
            <span className="text-sm text-amber-700 dark:text-amber-400">{t.live.remindersToday.replace("{count}", String(reminders.length))}</span>
          ) : null}
          <Button variant="outline" className="ml-auto" disabled={loading} onClick={() => void refresh()} aria-label={t.tenants.refresh} title={t.tenants.refresh}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {t.tenants.refresh}
          </Button>
          <Button variant="outline" disabled={exporting || filtered.length === 0} onClick={() => void exportExcel()}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t.tenants.export}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {sortHead("createdAt", t.live.date, "min-w-40")}
                  {sortHead("code", t.live.code, "w-28 min-w-28")}
                  {sortHead("name", t.live.name, "min-w-40")}
                  {sortHead("phone", t.live.phone, "min-w-36")}
                  {sortHead("email", t.live.email, "min-w-40")}
                  {sortHead("status", t.live.status, "w-36 min-w-36")}
                  {sortHead("duration", t.live.duration, "w-24")}
                  {sortHead("participants", t.live.participants, "w-24")}
                  {sortHead("reminder", t.live.reminder, "min-w-36")}
                  <TableHead className="w-20" />
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderDateRange from={dates.from} to={dates.to} onChange={(from, to) => setDates({ from, to })} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.code} onChange={(value) => setFilters((current) => ({ ...current, code: value }))} label={t.live.code} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.name} onChange={(value) => setFilters((current) => ({ ...current, name: value }))} label={t.live.name} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.phone} onChange={(value) => setFilters((current) => ({ ...current, phone: value }))} label={t.live.phone} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.email} onChange={(value) => setFilters((current) => ({ ...current, email: value }))} label={t.live.email} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} allLabel={t.common.all} label={t.live.status} className="min-w-0" />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal" />
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal" />
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderDateRange from={reminderDates.from} to={reminderDates.to} onChange={(from, to) => setReminderDates({ from, to })} future />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      <span className="flex flex-col items-center gap-2">
                        <Loader2 className="size-6 animate-spin" />
                        {t.common.loading}
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      <span className="flex flex-col items-center gap-2">
                        {tab === "reminders" ? <CalendarClock className="size-6" /> : <Video className="size-6" />}
                        {tab === "reminders" ? t.live.noReminders : t.live.empty}
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => {
                    const minutes = durationMinutes(item);
                    const due = isReminderDue(item);
                    const people = guestCount(item);
                    return (
                      <TableRow key={item.id} className="group cursor-pointer" onClick={() => open(item)}>
                        <TableCell className="text-sm">
                          <span className="tabular-nums">{formatDateTime(item.createdAt, locale)}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.inviteCode ? (
                            <span className="flex items-center gap-1">
                              <a href={`${BASE_PATH}/live/room/${item.inviteCode}`} target="_blank" rel="noopener" className="hover:text-foreground hover:underline" title={t.live.openRoom} onClick={(event) => event.stopPropagation()}>
                                {item.inviteCode}
                              </a>
                              <a
                                href={`${BASE_PATH}/live/room/${item.inviteCode}`}
                                target="_blank"
                                rel="noopener"
                                aria-label={t.live.openRoom}
                                title={t.live.openRoom}
                                className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100")}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={t.live.copyLink}
                                title={t.live.copyLink}
                                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void copyInvite(item.inviteCode);
                                }}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className={cn("text-sm", item.isNew && "font-semibold")}>
                          <span className="flex items-center gap-2">
                            {item.isNew ? <span className="size-2 shrink-0 rounded-full bg-sky-500" /> : null}
                            {item.name || <span className="text-muted-foreground">{t.live.anonymous}</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.phone ? (
                            <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>
                              {item.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-52 truncate text-sm" title={item.email || undefined}>
                          {item.email ? (
                            <a href={`mailto:${item.email}`} className="text-primary underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>
                              {item.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={item.status} />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {minutes ? (
                            t.live.minutes.replace("{count}", String(minutes))
                          ) : item.status === "active" && item.startedAt ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-current" />
                              {t.live.running}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {people > 0 ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground" title={item.participants.filter((entry) => entry.role === "guest").map((entry) => entry.name).join(", ")}>
                              <Users className="size-3.5" />
                              {people}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.reminderAt ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                item.reminderDone ? "bg-muted text-muted-foreground line-through" : due ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-sky-500/10 text-sky-700 dark:text-sky-400",
                              )}
                            >
                              <CalendarClock className="size-3.5" />
                              {formatDate(item.reminderAt, locale)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            {item.reminderAt && !item.reminderDone ? (
                              <Button variant="ghost" size="icon-sm" aria-label={t.live.markDone} title={t.live.markDone} onClick={() => void patchSession(item.id, { reminderDone: true })}>
                                <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {filtered.length > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t.live.total.replace("{count}", String(filtered.length))}</span>
          </div>
        ) : null}
      </main>

      <AppearanceDialog open={appearanceOpen} value={settings?.appearance ?? emptyAppearance()} onClose={() => setAppearanceOpen(false)} onSave={(appearance) => saveSettings({ appearance })} />
      <LiveSessionDialog
        session={selected}
        sessions={items}
        onClose={() => setSelectedId(null)}
        onSave={(patch) => {
          if (selected) void patchSession(selected.id, patch, t.live.saved);
        }}
        onDelete={() => {
          if (selected) void removeSession(selected.id);
        }}
        onOpenOther={(id) => setSelectedId(id)}
        onCopy={(code) => void copyInvite(code)}
        onStart={(id) => void startSession(id)}
      />
    </div>
  );
}
