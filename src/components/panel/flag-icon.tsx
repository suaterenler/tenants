"use client";

import flags from "react-phone-number-input/flags";
import type { Country } from "react-phone-number-input";

export function FlagIcon({ country, className }: { country: string; className?: string }) {
  const Flag = flags[country as Country];
  if (!Flag) return null;
  return (
    <span className={className ?? "inline-flex h-3.5 w-5 shrink-0 items-center [&_svg]:h-3.5 [&_svg]:w-5"}>
      <Flag title={country} />
    </span>
  );
}
