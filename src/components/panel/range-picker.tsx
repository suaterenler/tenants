"use client";

import { useState } from "react";
import type { DateRange as DayRange } from "react-day-picker";
import { enUS, tr } from "react-day-picker/locale";
import { CalendarRange, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FUTURE_PRESETS, fromDateKey, futurePresetRange, presetRange, RANGE_PRESETS, toDateKey, type FuturePreset, type RangePreset, type RangeValue } from "@/lib/date-range";
import { dateLocaleTag } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function RangePicker({ value, onChange, future = false }: { value: RangeValue; onChange: (value: RangeValue) => void; future?: boolean }) {
  const { locale, messages: t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>(undefined);
  const has = value.from !== "" || value.to !== "";
  const selected: DayRange | undefined = draft ?? (value.from ? { from: fromDateKey(value.from), to: value.to ? fromDateKey(value.to) : undefined } : undefined);
  const presets: (RangePreset | FuturePreset)[] = future ? FUTURE_PRESETS : RANGE_PRESETS;
  const rangeOf = (preset: RangePreset | FuturePreset): RangeValue => (future ? futurePresetRange(preset as FuturePreset) : presetRange(preset as RangePreset));
  const active = presets.find((preset) => {
    const range = rangeOf(preset);
    return range.from === value.from && range.to === value.to;
  });
  const tag = dateLocaleTag(locale);
  const label = (key: string) => fromDateKey(key).toLocaleDateString(tag, { day: "2-digit", month: "2-digit", year: "numeric" });
  const text = !has ? t.common.all : value.from === value.to ? label(value.from) : `${value.from ? label(value.from) : ""} – ${value.to ? label(value.to) : ""}`;

  const apply = (next: RangeValue) => {
    onChange(next);
    setDraft(undefined);
    setOpen(false);
  };

  return (
    <div className="relative w-full min-w-48 font-normal" onClick={(event) => event.stopPropagation()}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDraft(undefined);
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-1.5 pr-7 text-xs font-normal" aria-label={t.common.date}>
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" />
              <span className={cn("truncate tabular-nums", !has && "text-muted-foreground")}>{text}</span>
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
              {presets.map((preset) => (
                <Button key={preset} size="sm" variant="ghost" className={cn("justify-start", active === preset && "bg-primary/10 text-primary")} onClick={() => apply(rangeOf(preset))}>
                  {t.common[preset]}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2 p-2">
              <Calendar
                mode="range"
                numberOfMonths={2}
                weekStartsOn={1}
                locale={locale === "en" ? enUS : tr}
                defaultMonth={selected?.from}
                selected={selected}
                onSelect={(range, day) => {
                  if (!draft) {
                    setDraft({ from: day, to: undefined });
                    return;
                  }
                  const from = range?.from ?? day;
                  const to = range?.to ?? from;
                  apply({ from: toDateKey(from), to: toDateKey(to) });
                }}
              />
              <p className="px-1 text-xs text-muted-foreground">{draft?.from ? t.common.pickEnd : t.common.pickStart}</p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {has ? (
        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => apply({ from: "", to: "" })} aria-label={t.common.clear}>
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
