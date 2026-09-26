"use client";

import { useId, useMemo, useRef, useState, type ComponentProps } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FlagIcon } from "@/components/panel/flag-icon";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, phoneCountryOfCode } from "@/lib/countries";
import { AsYouType, type CountryCode } from "libphonenumber-js";
import { cn } from "@/lib/utils";
import { digitsOnly, splitPhone, storagePhone } from "@/lib/phone";

type PhoneInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (digits: string) => void;
  defaultCountry?: string;
};

export function PhoneInput({ value, onChange, defaultCountry = DEFAULT_PHONE_COUNTRY, ...props }: PhoneInputProps) {
  const derived = splitPhone(value, defaultCountry);
  const [countryOverride, setCountryOverride] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const country = phoneCountryOfCode(countryOverride ?? derived.country.code);
  const national = useMemo(() => {
    const digits = digitsOnly(value);
    if (digits.startsWith(country.cc)) return digits.slice(country.cc.length);
    return digits.replace(/^0+/, "");
  }, [value, country]);
  const display = useMemo(() => new AsYouType(country.code as CountryCode).input(national), [country.code, national]);

  const pick = (code: string) => {
    const next = phoneCountryOfCode(code);
    setCountryOverride(code);
    setOpen(false);
    setQuery("");
    onChange(derived.national === "" ? next.cc : storagePhone(derived.national, code));
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (needle === "") return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(needle) || item.cc.startsWith(digitsOnly(needle)));
  }, [query]);

  return (
    <div className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-0 text-base text-foreground transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30 md:text-sm">
      <PopoverPrimitive.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setQuery(""); }}>
        <PopoverPrimitive.Trigger
          render={
            <button
              type="button"
              className="flex h-full shrink-0 cursor-pointer items-center gap-1 border-r border-input pr-1.5 outline-none"
              aria-label={country.name}
            />
          }
        >
          <FlagIcon country={country.code} />
          <span className="text-xs font-medium text-muted-foreground tabular-nums">+{country.cc}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner sideOffset={6} className="z-50">
            <PopoverPrimitive.Popup className="w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
              <div className="relative mb-1">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  clearable={false}
                  placeholder="Ara..."
                  className="h-8 border-0 pl-7 text-sm focus-visible:ring-0"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <ul id={listId} className="max-h-64 overflow-y-auto">
                {filtered.map((item) => (
                  <li key={item.code}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                        item.code === country.code && "bg-accent/60",
                      )}
                      onClick={() => pick(item.code)}
                    >
                      <FlagIcon country={item.code} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">+{item.cc}</span>
                      {item.code === country.code ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 ? <li className="px-2 py-3 text-center text-sm text-muted-foreground">—</li> : null}
              </ul>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      <Input
        {...props}
        type="tel"
        inputMode="tel"
        clearable={false}
        className="!h-full !min-w-0 !flex-1 !rounded-none !border-0 !bg-transparent !px-1 !py-0 !shadow-none focus-visible:!ring-0 dark:!bg-transparent"
        value={display}
        onChange={(event) => onChange(storagePhone(event.target.value, country.code))}
      />
    </div>
  );
}
