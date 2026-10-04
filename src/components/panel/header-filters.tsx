"use client";

import { X } from "lucide-react";
import { RangePicker } from "@/components/panel/range-picker";
import { OptionSelect } from "@/components/panel/option-select";
import { Input } from "@/components/ui/input";

export function HeaderText({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div className="relative min-w-28 font-normal" onClick={(event) => event.stopPropagation()}>
      <Input className="h-8 pr-6 text-xs font-normal" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} placeholder={label} />
      {value ? (
        <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => onChange("")} aria-label={label}>
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function HeaderSelect({ value, onChange, options, allLabel, label, className = "min-w-32" }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; allLabel: string; label: string; className?: string }) {
  return (
    <div className={`relative w-full font-normal ${className}`} onClick={(event) => event.stopPropagation()}>
      <OptionSelect compact value={value} onChange={onChange} options={options} emptyLabel={allLabel} ariaLabel={label} />
      {value ? (
        <button type="button" className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => onChange("")} aria-label={label}>
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function HeaderDateRange({ from, to, onChange, future = false }: { from: string; to: string; onChange: (from: string, to: string) => void; future?: boolean }) {
  return <RangePicker value={{ from, to }} onChange={(value) => onChange(value.from, value.to)} future={future} />;
}
