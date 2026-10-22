"use client";

import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Field } from "@/components/panel/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LIVE_TEXT_KEYS, emptyAppearance, type LiveAppearance, type LiveTexts } from "@/lib/live";
import { cn } from "@/lib/utils";

const DEFAULTS: Record<"tr" | "en", LiveTexts> = {
  tr: {
    title: "Ücretsiz canlı görüşme ve sunum",
    subOn: "Uzmanımız şimdi görüntülü bağlansın, ürünü birlikte inceleyelim.",
    subOff: "Şu an müsait değiliz. Talebinizi bırakın, sizi arayalım.",
    startNow: "Hemen görüşme başlat",
    requestCall: "Canlı görüşme talep et",
  },
  en: {
    title: "Free live consultation and demo",
    subOn: "Talk to our expert on video right now and explore the product together.",
    subOff: "We are not available right now. Leave a request and we will call you.",
    startNow: "Start a call now",
    requestCall: "Request a live call",
  },
};

const SWATCHES = ["#0b1a36", "#1e3a8a", "#6282ea", "#7c3aed", "#0f766e", "#16a34a", "#db2777", "#ea580c", "#111827"];

function readable(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0b1a36" : "#ffffff";
}

function ColorField({ label, value, onChange, defaultLabel }: { label: string; value: string; onChange: (value: string) => void; defaultLabel: string }) {
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => onChange("")} title={defaultLabel} aria-label={defaultLabel} className={cn("inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs", value === "" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
          {defaultLabel}
        </button>
        {SWATCHES.map((color) => (
          <button key={color} type="button" onClick={() => onChange(color)} title={color} aria-label={color} className={cn("size-8 rounded-md ring-offset-2 ring-offset-background", value === color && "ring-2 ring-primary")} style={{ background: color }} />
        ))}
        <input type="color" value={value || "#2f7bff"} onChange={(event) => onChange(event.target.value)} className="size-8 cursor-pointer rounded-md border bg-transparent p-0.5" aria-label={label} title={label} />
        <Input
          value={draft}
          placeholder="#000000"
          maxLength={7}
          className="h-8 w-24 font-mono text-xs"
          onChange={(event) => {
            setDraft(event.target.value);
            if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
          }}
        />
      </div>
    </Field>
  );
}

export function AppearanceDialog({ open, value, onClose, onSave }: { open: boolean; value: LiveAppearance; onClose: () => void; onSave: (value: LiveAppearance) => Promise<void> }) {
  const { messages } = useI18n();
  const t = messages.live.appearance;
  const [draft, setDraft] = useState<LiveAppearance>(value);
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }

  const texts = draft[lang];
  const shown = (key: keyof LiveTexts) => texts[key] || DEFAULTS[lang][key];
  const banner = draft.color || "#0b1a36";
  const button = draft.buttonColor || "#2f7bff";

  function setText(key: keyof LiveTexts, text: string) {
    setDraft((current) => ({ ...current, [lang]: { ...current[lang], [key]: text } }));
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || busy ? undefined : onClose())}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[68vh] flex-col gap-5 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-xl border">
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: draft.color ? banner : "linear-gradient(90deg,#0b1a36,#14336b)", color: readable(banner) }}>
              <span className="size-2.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{shown("title")}</span>
                <span className="truncate text-xs opacity-80">{shown("subOn")}</span>
              </span>
              <span className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold shadow" style={{ background: draft.buttonColor ? button : "linear-gradient(135deg,#2f7bff,#4fb8ff)", color: readable(button) }}>
                {shown("startNow")}
              </span>
              <X className="size-4 shrink-0 opacity-80" />
            </div>
            <div className="bg-muted/40 px-4 py-2 text-xs text-muted-foreground">{t.preview}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ColorField label={t.bannerColor} value={draft.color} onChange={(color) => setDraft((current) => ({ ...current, color }))} defaultLabel={t.default} />
            <ColorField label={t.buttonColor} value={draft.buttonColor} onChange={(buttonColor) => setDraft((current) => ({ ...current, buttonColor }))} defaultLabel={t.default} />
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-lg bg-muted p-1">
                {(["tr", "en"] as const).map((key) => (
                  <button key={key} type="button" onClick={() => setLang(key)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", lang === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {key === "tr" ? "Türkçe" : "English"}
                  </button>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, [lang]: emptyAppearance()[lang] }))}>
                <RotateCcw className="size-3.5" />
                {t.resetTexts}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {LIVE_TEXT_KEYS.map((key) => (
                <div key={key} className={key === "subOn" || key === "subOff" ? "md:col-span-2" : undefined}>
                  <Field label={t.fields[key]}>
                    <Input value={texts[key]} maxLength={160} placeholder={DEFAULTS[lang][key]} onChange={(event) => setText(key, event.target.value)} />
                  </Field>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t.hint}</p>
          </section>

          <section className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">{t.scriptTitle}</div>
            <p className="mb-2">{t.scriptHint}</p>
            <code className="block overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px] whitespace-pre">{`<script src="https://app.erenleryazilim.com/admin/live/widget.js" defer
  data-color="#6282ea" data-button-color="#ffffff"
  data-title="…" data-title-en="…"
  data-subtitle-on="…" data-subtitle-off="…"
  data-button-on="…" data-button-off="…"></script>`}</code>
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {messages.common.cancel}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {messages.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
