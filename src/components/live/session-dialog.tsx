"use client";

import Image from "next/image";
import { useState } from "react";
import { CalendarClock, Check, Copy, ExternalLink, Globe, Mail, MessageSquare, Phone, RotateCcw, Trash2, Users, Video } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { FileIcon, isImageFile, LinkedText } from "@/components/live/linked-text";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { DatePicker } from "@/components/panel/date-picker";
import { Field } from "@/components/panel/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, formatDateTime } from "@/lib/format";
import { durationMinutes, formatPhone, initials, isValidPhone, type LiveSession, type LiveSessionPatch, type LiveStatus, previousSessions } from "@/lib/live";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<LiveStatus, string> = {
  waiting: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  active: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  request: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  missed: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const STATUS_COLOR: Record<LiveStatus, string> = {
  waiting: "#8b5cf6",
  active: "#0ea5e9",
  request: "#f59e0b",
  completed: "#10b981",
  missed: "#64748b",
  rejected: "#ef4444",
};

export function StatusPill({ status }: { status: LiveStatus }) {
  const t = useI18n().messages;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLE[status])}>{t.live.statuses[status]}</span>;
}

function timeOf(value: string, locale: string): string {
  return new Date(value).toLocaleTimeString(locale === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit" });
}

type Draft = { name: string; phone: string; email: string; hostNotes: string; reminderAt: string; reminderDone: boolean };

function draftOf(session: LiveSession): Draft {
  return {
    name: session.name,
    phone: session.phone,
    email: session.email,
    hostNotes: session.hostNotes,
    reminderAt: session.reminderAt ? session.reminderAt.slice(0, 10) : "",
    reminderDone: session.reminderDone,
  };
}

export function LiveSessionDialog({
  session,
  sessions,
  onClose,
  onSave,
  onDelete,
  onOpenOther,
  onCopy,
  onStart,
}: {
  session: LiveSession | null;
  sessions: LiveSession[];
  onClose: () => void;
  onSave: (patch: LiveSessionPatch) => void;
  onDelete: () => void;
  onOpenOther: (id: string) => void;
  onCopy: (code: string) => void;
  onStart: (id: string) => void;
}) {
  const { messages: t, locale } = useI18n();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [panel, setPanel] = useState<"chat" | "people">("chat");

  if (session && draftFor !== session.id) {
    setDraftFor(session.id);
    setDraft(draftOf(session));
    setPanel(session.messages.length > 0 ? "chat" : "people");
  }

  const current = session && draft ? draft : null;
  const phoneBad = Boolean(current?.phone.trim()) && !isValidPhone(current?.phone ?? "");
  const dirty = session && current ? JSON.stringify(draftOf(session)) !== JSON.stringify(current) : false;
  const previous = session ? previousSessions(sessions, session) : [];
  const minutes = session ? durationMinutes(session) : null;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function save() {
    if (!current) return;
    onSave({
      name: current.name.trim(),
      phone: current.phone.trim(),
      email: current.email.trim(),
      hostNotes: current.hostNotes,
      reminderAt: current.reminderAt ? new Date(`${current.reminderAt}T10:00:00`).toISOString() : null,
      reminderDone: current.reminderDone,
    });
  }

  async function remove() {
    const ok = await confirm({ message: t.live.deleteConfirm, confirmText: t.common.delete, danger: true });
    if (ok) onDelete();
  }

  return (
    <Dialog open={session !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t.live.detail}
            {session ? <StatusPill status={session.status} /> : null}
          </DialogTitle>
        </DialogHeader>
        {session && current ? (
          <div className="grid h-[68vh] gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">{initials(current.name)}</span>
                <div className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="truncate text-base font-semibold">{current.name || t.live.anonymous}</span>
                  <span className="flex flex-wrap gap-x-3 text-muted-foreground">
                    <span className="tabular-nums">{formatDateTime(session.createdAt, locale)}</span>
                    {minutes ? <span>{t.live.minutes.replace("{count}", String(minutes))}</span> : null}
                  </span>
                </div>
                {session.inviteCode ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.live.inviteCode}</span>
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 font-mono text-sm hover:bg-muted" onClick={() => onCopy(session.inviteCode)} title={t.live.copyLink}>
                      {session.inviteCode}
                      <Copy className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : null}
              </div>

              <section className="grid gap-3 sm:grid-cols-2">
                <Field label={t.live.name} htmlFor="live-name" required hint={current.name.trim() ? undefined : t.errors.liveNameRequired}>
                  <Input id="live-name" value={current.name} aria-invalid={current.name.trim() ? undefined : true} onChange={(event) => set("name", event.target.value)} />
                </Field>
                <Field label={t.live.phone} htmlFor="live-phone" hint={phoneBad ? t.live.badPhone : undefined}>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="live-phone" className="pl-8" placeholder="5xx xxx xx xx" inputMode="tel" aria-invalid={phoneBad || undefined} value={current.phone} onChange={(event) => set("phone", formatPhone(event.target.value))} />
                  </div>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t.live.email} htmlFor="live-email">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input id="live-email" type="email" className="pl-8" value={current.email} onChange={(event) => set("email", event.target.value)} />
                    </div>
                  </Field>
                </div>
              </section>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Globe className="size-3.5" />
                  {t.live.sourcePage}: <span className="font-mono">{session.page}</span>
                </span>
              </div>

              {session.note ? (
                <div className="rounded-md border-l-4 border-violet-500/60 bg-violet-500/5 px-3 py-2 text-sm">
                  <div className="text-xs font-medium text-violet-700 dark:text-violet-400">{t.live.visitorNote}</div>
                  {session.note}
                </div>
              ) : null}

              <Field label={t.live.hostNotes} htmlFor="live-notes">
                <Textarea id="live-notes" rows={5} value={current.hostNotes} placeholder={t.live.hostNotesPlaceholder} onChange={(event) => set("hostNotes", event.target.value)} />
              </Field>

              <section className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                <div className="min-w-44 flex-1">
                  <Field label={t.live.reminder}>
                    <DatePicker value={current.reminderAt} onChange={(value) => set("reminderAt", value)} minDate={new Date()} />
                  </Field>
                </div>
                <Button type="button" variant={current.reminderDone ? "secondary" : "outline"} disabled={!current.reminderAt} onClick={() => set("reminderDone", !current.reminderDone)}>
                  {current.reminderDone ? <Check className="size-4 text-emerald-600" /> : <CalendarClock className="size-4" />}
                  {current.reminderDone ? t.live.reminderDone : t.live.markDone}
                </Button>
              </section>

              {previous.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">{t.live.previous}</h3>
                  {previous.map((other) => (
                    <button key={other.id} type="button" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onOpenOther(other.id)}>
                      <span className="tabular-nums">{formatDateTime(other.createdAt, locale)}</span>
                      <StatusPill status={other.status} />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{other.hostNotes || "—"}</span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </section>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div className="flex border-b bg-muted/40 p-1">
                {(["chat", "people"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPanel(key)}
                    className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", panel === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {key === "chat" ? <MessageSquare className="size-4" /> : <Users className="size-4" />}
                    {key === "chat" ? t.live.chat : t.live.participants}
                    <span className="text-xs text-muted-foreground tabular-nums">{key === "chat" ? session.messages.length : session.participants.length}</span>
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {panel === "chat" ? (
                  session.messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="size-6" />
                      {t.live.noChat}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {session.messages.map((message) => (
                        <div key={message.id} className={cn("flex max-w-[85%] flex-col gap-0.5", message.role === "host" ? "self-end items-end" : "self-start")}>
                          <span className="px-1 text-[11px] text-muted-foreground">
                            {message.role === "host" ? t.live.host : message.author} · {timeOf(message.at, locale)}
                            {message.file && isImageFile(message.file.url) ? ` · ${formatBytes(message.file.size, locale)}` : ""}
                            {message.editedAt ? ` · ${t.live.room.edited}` : ""}
                          </span>
                          {message.text ? (
                            <span className={cn("rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap", message.role === "host" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                              <LinkedText text={message.text} />
                            </span>
                          ) : null}
                          {message.file && isImageFile(message.file.url) ? (
                            <a href={message.file.url} target="_blank" rel="noreferrer" className="block w-fit overflow-hidden rounded-xl hover:opacity-90" title={message.file.name}>
                              <Image src={message.file.url} alt={message.file.name} width={480} height={320} unoptimized className="h-auto max-h-48 w-auto max-w-full object-contain" />
                            </a>
                          ) : null}
                          {message.file && !isImageFile(message.file.url) ? (
                            <a href={message.file.url} target="_blank" rel="noreferrer" className={cn("inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-primary underline-offset-4 hover:underline", message.role === "host" ? "self-end" : "self-start")}>
                              <FileIcon name={message.file.name} />
                              <span className="truncate">{message.file.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{Math.max(1, Math.round(message.file.size / 1024))} KB</span>
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )
                ) : session.participants.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-6" />—
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {session.participants.map((person, index) => (
                      <li key={`${person.name}-${index}`} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", person.role === "host" ? "bg-primary text-primary-foreground" : "bg-muted")}>{initials(person.name)}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">
                            {person.name}
                            {person.role === "host" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t.live.host})</span> : null}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t.live.joined.replace("{time}", timeOf(person.joinedAt, locale))}
                            {" · "}
                            {person.leftAt ? t.live.left.replace("{time}", timeOf(person.leftAt, locale)) : t.live.stillIn}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{person.inviteCode}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void remove()}>
            <Trash2 className="size-4" />
            {t.common.delete}
          </Button>
          <div className="flex flex-wrap gap-2">
            {session?.inviteCode ? (
              <Button type="button" variant="secondary" onClick={() => onStart(session.id)}>
                <RotateCcw className="size-4" />
                {t.live.reopen}
              </Button>
            ) : session ? (
              <Button type="button" variant="secondary" onClick={() => onStart(session.id)}>
                <Video className="size-4" />
                {t.live.callBack}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.close}
            </Button>
            <Button type="button" onClick={save} disabled={!dirty || !current?.name.trim() || phoneBad}>
              {t.common.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
