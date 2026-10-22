"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Moon, RotateCcw, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Field } from "@/components/panel/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const HEX = /^#[0-9a-f]{6}$/i;

const WIDGET_SRC = "https://app.erenleryazilim.com/admin/live/widget.js";

const TEXT_ATTRS: Record<keyof LiveTexts, string> = { title: "data-title", subOn: "data-subtitle-on", subOff: "data-subtitle-off", startNow: "data-button-on", requestCall: "data-button-off" };

function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function embedCode(value: LiveAppearance): string {
  const attrs: string[] = [];
  const colors: [string, string][] = [
    ["data-color", value.color],
    ["data-color-dark", value.colorDark],
    ["data-button-color", value.buttonColor],
    ["data-button-color-dark", value.buttonColorDark],
  ];
  for (const [name, color] of colors) if (color) attrs.push(`${name}="${attr(color)}"`);
  for (const key of LIVE_TEXT_KEYS) {
    if (value.tr[key]) attrs.push(`${TEXT_ATTRS[key]}="${attr(value.tr[key])}"`);
    if (value.en[key]) attrs.push(`${TEXT_ATTRS[key]}-en="${attr(value.en[key])}"`);
  }
  if (attrs.length === 0) return `<script src="${WIDGET_SRC}" defer></script>`;
  return `<script src="${WIDGET_SRC}" defer\n${attrs.map((item) => `  ${item}`).join("\n")}></script>`;
}

const SITE_SAMPLE = "linear-gradient(135deg,#6282ea,#6ec9e4)";

function paint(value: string, fallback: string): string {
  if (value === "auto") return SITE_SAMPLE;
  return HEX.test(value) ? value : fallback;
}

function readable(hex: string): string {
  if (!HEX.test(hex)) return "#ffffff";
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0b1a36" : "#ffffff";
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="inline-flex w-fit rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", value === option.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ColorCell({ value, onChange, onOpen, defaultLabel, autoLabel, customLabel }: { value: string; onChange: (value: string) => void; onOpen: () => void; defaultLabel: string; autoLabel: string; customLabel: string }) {
  const [draft, setDraft] = useState(HEX.test(value) ? value : "");
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(HEX.test(value) ? value : "");
  }
  const swatch = value === "auto" ? SITE_SAMPLE : HEX.test(value) ? value : "repeating-linear-gradient(45deg,#d4d4d8 0 4px,transparent 4px 8px)";
  const text = value === "auto" ? autoLabel : HEX.test(value) ? value : defaultLabel;
  const chip = (active: boolean) => cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs", active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted");
  return (
    <Popover onOpenChange={(open) => (open ? onOpen() : undefined)}>
      <PopoverTrigger
        render={
          <button type="button" className="flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm hover:bg-muted/60">
            <span className="size-6 shrink-0 rounded-md border" style={{ background: swatch }} />
            <span className={cn("min-w-0 flex-1 truncate text-sm", HEX.test(value) && "font-mono")}>{text}</span>
          </button>
        }
      />
      <PopoverContent className="w-64" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onChange("auto")} className={chip(value === "auto")}>
              <span className="size-3.5 rounded-full" style={{ background: SITE_SAMPLE }} />
              {autoLabel}
            </button>
            <button type="button" onClick={() => onChange("")} className={chip(value === "")}>
              {defaultLabel}
            </button>
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {SWATCHES.map((color) => (
              <button key={color} type="button" onClick={() => onChange(color)} title={color} aria-label={color} className={cn("aspect-square rounded-full ring-offset-2 ring-offset-background", value === color && "ring-2 ring-primary")} style={{ background: color }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border" title={customLabel} style={{ background: HEX.test(value) ? value : "transparent" }}>
              <input type="color" value={HEX.test(value) ? value : "#2f7bff"} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={customLabel} />
            </label>
            <Input
              value={draft}
              placeholder="#000000"
              maxLength={7}
              className="h-8 font-mono text-xs"
              onChange={(event) => {
                setDraft(event.target.value);
                if (HEX.test(event.target.value)) onChange(event.target.value.toLowerCase());
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppearanceDialog({ open, value, onClose, onSave }: { open: boolean; value: LiveAppearance; onClose: () => void; onSave: (value: LiveAppearance) => Promise<void> }) {
  const { messages } = useI18n();
  const t = messages.live.appearance;
  const [draft, setDraft] = useState<LiveAppearance>(value);
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [tab, setTab] = useState<"colors" | "texts" | "script">("colors");
  const [copied, setCopied] = useState("");
  const code = embedCode(draft);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied((current) => (current === text ? "" : current)), 2000);
    } catch {
      setCopied("");
    }
  }
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }

  const texts = draft[lang];
  const shown = (key: keyof LiveTexts) => texts[key] || DEFAULTS[lang][key];
  const bannerValue = mode === "dark" ? draft.colorDark || draft.color : draft.color;
  const buttonValue = mode === "dark" ? draft.buttonColorDark || draft.buttonColor : draft.buttonColor;
  const banner = paint(bannerValue, "linear-gradient(90deg,#0b1a36,#14336b)");
  const button = paint(buttonValue, "linear-gradient(135deg,#2f7bff,#4fb8ff)");

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
      <DialogContent className="sm:max-w-3xl" bodyClassName="flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className={cn("shrink-0 overflow-hidden rounded-xl border", mode === "dark" ? "bg-[#0f121b]" : "bg-[#fcfcfd]")}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: banner, color: bannerValue === "auto" ? "#ffffff" : readable(bannerValue) }}>
              <span className="size-2.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{shown("title")}</span>
                <span className="truncate text-xs opacity-80">{shown("subOn")}</span>
              </span>
              <span className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold shadow" style={{ background: buttonValue === "auto" ? "#ffffff" : button, color: buttonValue === "auto" ? "#6282ea" : readable(buttonValue) }}>
                {shown("startNow")}
              </span>
            </div>
            <div className={cn("flex items-center gap-2 px-3 py-1.5 text-xs", mode === "dark" ? "text-neutral-400" : "text-neutral-500")}>
              <span className="min-w-0 flex-1 truncate">{bannerValue === "auto" || buttonValue === "auto" ? t.previewAuto : t.preview}</span>
              <span className={cn("inline-flex shrink-0 rounded-md p-0.5", mode === "dark" ? "bg-white/10" : "bg-black/5")}>
                {(["light", "dark"] as const).map((key) => (
                  <button key={key} type="button" onClick={() => setMode(key)} title={t.modes[key]} aria-label={t.modes[key]} className={cn("inline-flex size-6 items-center justify-center rounded", mode === key ? (mode === "dark" ? "bg-white/20 text-white" : "bg-white text-neutral-900 shadow-sm") : "")}>
                    {key === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 border-b">
            {(["colors", "texts", "script"] as const).map((key) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors", tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.tabs[key]}
              </button>
            ))}
          </div>

          <div className="min-h-40 flex-1 basis-[29rem] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tab === "colors" ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                  <span />
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Sun className="size-3.5" />
                    {t.modes.light}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Moon className="size-3.5" />
                    {t.modes.dark}
                  </span>
                  <span className="text-sm font-medium">{t.bannerColor}</span>
                  <ColorCell value={draft.color} onChange={(color) => setDraft((current) => ({ ...current, color }))} onOpen={() => setMode("light")} defaultLabel={t.default} autoLabel={t.siteColor} customLabel={t.custom} />
                  <ColorCell value={draft.colorDark} onChange={(colorDark) => setDraft((current) => ({ ...current, colorDark }))} onOpen={() => setMode("dark")} defaultLabel={t.sameAsLight} autoLabel={t.siteColor} customLabel={t.custom} />
                  <span className="text-sm font-medium">{t.buttonColor}</span>
                  <ColorCell value={draft.buttonColor} onChange={(buttonColor) => setDraft((current) => ({ ...current, buttonColor }))} onOpen={() => setMode("light")} defaultLabel={t.default} autoLabel={t.siteColor} customLabel={t.custom} />
                  <ColorCell value={draft.buttonColorDark} onChange={(buttonColorDark) => setDraft((current) => ({ ...current, buttonColorDark }))} onOpen={() => setMode("dark")} defaultLabel={t.sameAsLight} autoLabel={t.siteColor} customLabel={t.custom} />
                </div>
                <p className="text-xs text-muted-foreground">{t.modeHint}</p>
              </div>
            ) : tab === "texts" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Segmented value={lang} onChange={setLang} options={[{ value: "tr", label: "Türkçe" }, { value: "en", label: "English" }]} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, [lang]: emptyAppearance()[lang] }))}>
                    <RotateCcw className="size-3.5" />
                    {t.resetTexts}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {LIVE_TEXT_KEYS.map((key) => (
                    <div key={key} className={key === "subOn" || key === "subOff" ? "sm:col-span-2" : undefined}>
                      <Field label={t.fields[key]}>
                        <Input value={texts[key]} maxLength={160} placeholder={DEFAULTS[lang][key]} onChange={(event) => setText(key, event.target.value)} />
                      </Field>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
            ) : (
              <div className="flex h-full flex-col text-xs text-muted-foreground">
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">{t.embedTitle}</span>
                  <p>{t.embedHint}</p>
                  <div className="flex min-h-0 items-start gap-2 overflow-y-auto rounded-md border bg-muted/40 p-2 [scrollbar-width:thin]">
                    <code className="min-w-0 flex-1 p-1 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-foreground">{code}</code>
                    <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => void copy(code)}>
                      {copied === code ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied === code ? t.copied : t.copy}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
