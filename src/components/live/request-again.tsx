"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, MessageSquare, Phone, PhoneCall, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { inviteUrl, loadInviteBase } from "@/components/live/invite";
import { readEvents } from "@/components/live/room-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BASE_PATH } from "@/lib/admin-client";
import { formatPhone, isValidPhone, LIVE_QUEUE_SECONDS } from "@/lib/live";
import { cn } from "@/lib/utils";

type Stage = "idle" | "name" | "waiting" | "message" | "sent";
type Notice = "" | "busy" | "unavailable" | "rejected" | "missed" | "queued";
type PendingRequest = { id: string; token: string };

const API = `${BASE_PATH}/api/live/public`;
const NAME_KEY = "erenler_live_name";

function savedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    return;
  }
}

function pendingKey(): string {
  return `erenler_live_again:${window.location.pathname}`;
}

function readPending(): PendingRequest | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(pendingKey()) ?? "null") as (PendingRequest & { at: number }) | null;
    if (!raw?.id || !raw.token || Date.now() - raw.at > LIVE_QUEUE_SECONDS * 1000) return null;
    return { id: raw.id, token: raw.token };
  } catch {
    return null;
  }
}

function storePending(request: PendingRequest | null) {
  try {
    if (request) window.localStorage.setItem(pendingKey(), JSON.stringify({ ...request, at: Date.now() }));
    else window.localStorage.removeItem(pendingKey());
  } catch {
    return;
  }
}

async function liveStatus(): Promise<{ available: boolean; busy: boolean }> {
  const response = await fetch(`${API}/status`, { cache: "no-store" });
  const data = (await response.json()) as { available?: boolean; busy?: boolean };
  return { available: Boolean(data.available), busy: Boolean(data.busy) };
}

export function RequestAgain({ extra }: { extra?: ReactNode }) {
  const { messages, locale } = useI18n();
  const t = messages.live.room;
  const [resumed] = useState(readPending);
  const [stage, setStage] = useState<Stage>(resumed ? "waiting" : "idle");
  const [notice, setNotice] = useState<Notice>("");
  const [name, setName] = useState(savedName);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingRequest | null>(resumed);
  const listeningRef = useRef(false);
  const [fromWaiting, setFromWaiting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      listeningRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!listeningRef.current && resumed) listen(resumed);
  });

  function listen(request: PendingRequest) {
    listeningRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const response = await fetch(`${API}/requests/${request.id}/events`, { headers: { "X-Live-Token": request.token }, signal: controller.signal, cache: "no-store" });
          if (!response.ok) return;
          await readEvents(response, (event, raw) => {
            const data = (raw ?? {}) as { code?: string };
            if (event === "accepted" && data.code) {
              controller.abort();
              storePending(null);
              const code = data.code;
              void loadInviteBase().then((base) => {
                const target = new URL(`${inviteUrl(code, base)}${locale === "en" ? "?lang=en" : ""}#t=${encodeURIComponent(request.token)}`, window.location.origin);
                window.location.assign(target);
              });
            } else if (event === "rejected" || event === "missed") {
              controller.abort();
              storePending(null);
              setNotice(event);
              setStage("message");
            }
          });
        } catch {
          if (controller.signal.aborted) return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    })();
  }

  async function start() {
    setError("");
    const known = savedName();
    setName(known);
    try {
      const status = await liveStatus();
      if (!status.available) {
        setNotice("unavailable");
        setStage("message");
        return;
      }
      if (known) await sendCall(known);
      else setStage("name");
    } catch {
      setError(t.failed);
    }
  }

  async function sendCall(value: string) {
    const clean = value.trim();
    if (!clean) {
      setError(messages.errors.liveNameRequired);
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${API}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "call", name: clean, page: window.location.pathname }) });
      if (response.status === 409) {
        setNotice("unavailable");
        setStage("message");
        return;
      }
      if (!response.ok) throw new Error("request");
      const data = (await response.json()) as PendingRequest;
      saveName(clean);
      setPending(data);
      storePending(data);
      const status = await liveStatus().catch(() => ({ available: true, busy: false }));
      setNotice(status.busy ? "busy" : "");
      setStage("waiting");
      listen(data);
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    abortRef.current?.abort();
    if (pending) await fetch(`${API}/requests/${pending.id}`, { method: "DELETE", headers: { "X-Live-Token": pending.token } }).catch(() => undefined);
    setPending(null);
    storePending(null);
    setNotice("");
    setStage("idle");
  }

  async function sendMessage() {
    const cleanName = name.trim();
    if (!cleanName) {
      setError(messages.errors.liveNameRequired);
      return;
    }
    if (fromWaiting && pending) {
      await sendQueuedNote(cleanName, pending);
      return;
    }
    if (!isValidPhone(phone)) {
      setError(t.requestPhoneRequired);
      return;
    }
    setSending(true);
    setError("");
    try {
      abortRef.current?.abort();
      const response = pending
        ? await fetch(`${API}/requests/${pending.id}/phone`, { method: "POST", headers: { "Content-Type": "application/json", "X-Live-Token": pending.token }, body: JSON.stringify({ name: cleanName, phone, note }) })
        : await fetch(`${API}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "callback", name: cleanName, phone, note, page: window.location.pathname }) });
      if (!response.ok) throw new Error("message");
      saveName(cleanName);
      setPending(null);
      storePending(null);
      setStage("sent");
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  }

  async function sendQueuedNote(cleanName: string, request: PendingRequest) {
    if (phone && !isValidPhone(phone)) {
      setError(t.requestPhoneRequired);
      return;
    }
    if (!note.trim() && !phone) {
      setError(t.requestNoteRequired);
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${API}/requests/${request.id}/note`, { method: "POST", headers: { "Content-Type": "application/json", "X-Live-Token": request.token }, body: JSON.stringify({ name: cleanName, phone, note }) });
      if (!response.ok) throw new Error("note");
      saveName(cleanName);
      setNote("");
      setFromWaiting(false);
      setNotice("queued");
      setStage("waiting");
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  }

  const noticeText = notice === "queued" ? t.requestQueuedMessage : notice === "busy" ? t.requestBusy : notice === "unavailable" ? t.requestUnavailable : notice === "rejected" ? t.requestRejected : notice === "missed" ? t.requestMissed : "";

  if (stage === "idle") {
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <div className={cn("grid gap-2", extra ? "w-full max-w-md sm:grid-cols-2 [&>button]:w-full" : "")}>
          {extra}
          <Button className="h-10 bg-emerald-600 px-5 text-white hover:bg-emerald-700" onClick={() => void start()}>
            <PhoneCall className="size-4" />
            {t.requestAgain}
          </Button>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  if (stage === "sent") {
    return <p className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{t.requestMessageSent}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-left">
      {noticeText ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{noticeText}</p> : null}
      {stage === "name" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCall(name);
          }}
        >
          <label htmlFor="live-again-name" className="text-sm text-neutral-300">
            {t.nameLabel}
          </label>
          <Input id="live-again-name" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="h-10 border-white/15 bg-black/30" />
          <Button type="submit" disabled={sending} className="h-10 bg-emerald-600 text-white hover:bg-emerald-700">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
            {t.requestSend}
          </Button>
        </form>
      ) : null}
      {stage === "waiting" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin text-sky-300" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{t.requestWaiting}</span>
              <span className="text-xs text-neutral-400">{t.requestWaitingHint}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setFromWaiting(true);
                setError("");
                setStage("message");
              }}
            >
              <MessageSquare className="size-4" />
              {t.requestLeaveMessage}
            </Button>
            <Button variant="ghost" className="flex-1 text-neutral-300" onClick={() => void cancel()}>
              <X className="size-4" />
              {t.requestCancel}
            </Button>
          </div>
        </div>
      ) : null}
      {stage === "message" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="live-msg-name" className="text-sm text-neutral-300">
                {t.nameLabel}
              </label>
              <Input id="live-msg-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="h-10 border-white/15 bg-black/30" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="live-msg-phone" className="text-sm text-neutral-300">
                {fromWaiting ? t.requestPhoneOptional : t.requestPhone}
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500" />
                <Input id="live-msg-phone" inputMode="tel" placeholder="5xx xxx xx xx" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} className="h-10 border-white/15 bg-black/30 pl-9" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="live-msg-note" className="text-sm text-neutral-300">
              {t.requestNote}
            </label>
            <Textarea id="live-msg-note" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="border-white/15 bg-black/30" />
          </div>
          <Button type="submit" disabled={sending} className="h-10 bg-sky-600 text-white hover:bg-sky-700">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
            {fromWaiting ? t.requestSendAndWait : t.requestSendMessage}
          </Button>
          {fromWaiting ? (
            <Button
              type="button"
              variant="ghost"
              className="text-neutral-300"
              onClick={() => {
                setFromWaiting(false);
                setError("");
                setStage("waiting");
              }}
            >
              {t.requestBackToWaiting}
            </Button>
          ) : null}
        </form>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
