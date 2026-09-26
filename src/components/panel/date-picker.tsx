"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { enUS, tr } from "react-day-picker/locale";
import { useI18n } from "@/components/i18n-provider";
import { dateLocaleTag } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n: number) => String(n).padStart(2, "0");

export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  yearDropdown = false,
  maxDate,
  minDate,
  limitBackdate = false,
  defaultToday = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  yearDropdown?: boolean;
  maxDate?: Date;
  minDate?: Date;
  limitBackdate?: boolean;
  defaultToday?: boolean;
}) {
  const effectiveMin = limitBackdate ? backdateLimit() : minDate;
  const { locale, messages } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (defaultToday && !value) onChange(todayKey());
  }, [defaultToday, value, onChange]);

  const effective = value || (defaultToday ? todayKey() : "");
  const selected = toDate(effective);
  const label = selected ? selected.toLocaleDateString(dateLocaleTag(locale), { day: "2-digit", month: "2-digit", year: "numeric" }) : (placeholder ?? messages.common.notSelected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" disabled={disabled} aria-invalid={invalid || undefined} className="relative h-9 w-full justify-start gap-2 pr-8 font-normal">
            <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{label}</span>
            {effective && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                title={messages.common.clear}
                aria-label={messages.common.clear}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                  }
                }}
                className="absolute right-2 top-1/2 z-10 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-3" />
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex flex-col gap-2">
          <Calendar
            mode="single"
            locale={locale === "en" ? enUS : tr}
            selected={selected}
            defaultMonth={selected ?? maxDate}
            disabled={[...(maxDate ? [{ after: maxDate }] : []), ...(effectiveMin ? [{ before: effectiveMin }] : [])]}
            {...(yearDropdown
              ? {
                  captionLayout: "dropdown" as const,
                  startMonth: new Date(1920, 0),
                  endMonth: maxDate ?? new Date(new Date().getFullYear() + 10, 11),
                }
              : {})}
            onSelect={(day) => {
              if (!day) return;
              onChange(toDateValue(day));
              setOpen(false);
            }}
          />
          <div className="flex items-center gap-2 border-t pt-2">
            <Input
              clearable={false}
              type="date"
              className="h-8 w-36 text-xs"
              value={effective}
              max={maxDate ? toDateValue(maxDate) : undefined}
              min={effectiveMin ? toDateValue(effectiveMin) : undefined}
              onChange={(e) => onChange(e.target.value)}
            />
            {effective ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {messages.common.clear}
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const BACKDATE_LIMIT_DAYS = 7;

export function backdateLimit(days: number = BACKDATE_LIMIT_DAYS): Date {
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() - days);
  return limit;
}

export function todayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
