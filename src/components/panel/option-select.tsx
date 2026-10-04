"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlagIcon } from "@/components/panel/flag-icon";
import { hasTone, ToneLabel, type ToneProps } from "@/components/panel/tone-label";

export type SelectOption = { value: string; label: string; itemLabel?: string; depth?: number; hint?: string; flag?: string } & ToneProps;

function OptionLabel({ option }: { option: SelectOption }) {
  if (option.flag) {
    return (
      <span className="flex items-center gap-2">
        <FlagIcon country={option.flag} />
        <span className="truncate">{option.label}</span>
      </span>
    );
  }
  if (!hasTone(option)) return <>{option.label}</>;
  return <ToneLabel label={option.label} tone={option.tone} color={option.color} hint={option.hint} />;
}

export function OptionSelect({
  value,
  onChange,
  options,
  emptyLabel,
  ariaLabel,
  disabled,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  emptyLabel?: string;
  ariaLabel: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next ?? ""))} disabled={disabled}>
      <SelectTrigger size={compact ? "sm" : "default"} className={compact ? "h-8 w-full text-xs font-normal" : "w-full"} aria-label={ariaLabel}>
        <SelectValue>{selected ? <OptionLabel option={selected} /> : (emptyLabel ?? "")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {emptyLabel !== undefined ? <SelectItem value="">{emptyLabel}</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} style={option.depth ? { paddingLeft: `${0.5 + option.depth}rem` } : undefined}>
            <OptionLabel option={option.itemLabel ? { ...option, label: option.itemLabel } : option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
