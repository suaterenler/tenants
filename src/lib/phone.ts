import { parsePhoneNumberFromString } from "libphonenumber-js";
import { DEFAULT_PHONE_COUNTRY, phoneCountryOfCode, type PhoneCountry } from "./countries";

const TR_NATIONAL_GROUPS = [3, 3, 2, 2];
const CC_FREE_NATIONAL = new Set(["TR"]);

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function groupProgressive(value: string, sizes: number[]): string {
  const groups: string[] = [];
  let index = 0;
  for (const size of sizes) {
    if (index >= value.length) break;
    groups.push(value.slice(index, index + size));
    index += size;
  }
  if (index < value.length) groups.push(value.slice(index));
  return groups.join(" ");
}

export function canonicalPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 && /^[235]/.test(digits)) {
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    if (digits.startsWith("4") && parsed?.country && parsed.isValid()) return digits;
    return `90${digits}`;
  }
  return digits.slice(0, 15);
}

export function storagePhone(national: string, countryCode: string = DEFAULT_PHONE_COUNTRY): string {
  const country = phoneCountryOfCode(countryCode);
  let digits = digitsOnly(national).replace(/^0+/, "");
  if (digits === "") return "";
  if (digits.startsWith(country.cc) && (digits.length > country.nationalMax || CC_FREE_NATIONAL.has(country.code))) digits = digits.slice(country.cc.length).replace(/^0+/, "");
  return (country.cc + digits.slice(0, country.nationalMax)).slice(0, 15);
}

export function splitPhone(stored: string, fallbackCountryCode: string = DEFAULT_PHONE_COUNTRY): { country: PhoneCountry; national: string } {
  const digits = digitsOnly(stored);
  if (digits === "") return { country: phoneCountryOfCode(fallbackCountryCode), national: "" };
  const parsed = parsePhoneNumberFromString(`+${digits}`);
  let validCountry: PhoneCountry | null = null;
  let parsedNational: string | null = null;
  if (parsed?.country !== undefined && parsed.isValid()) {
    validCountry = phoneCountryOfCode(parsed.country);
    parsedNational = parsed.nationalNumber;
  }
  if (digits.length === 10 && /^[235]/.test(digits)) {
    if (digits.startsWith("4") && validCountry && parsedNational !== null) return { country: validCountry, national: parsedNational };
    return { country: phoneCountryOfCode(DEFAULT_PHONE_COUNTRY), national: digits };
  }
  if (validCountry && parsedNational !== null) return { country: validCountry, national: parsedNational };
  const fallback = phoneCountryOfCode(fallbackCountryCode);
  const national = digits.startsWith(fallback.cc) && digits.length > fallback.cc.length ? digits.slice(fallback.cc.length) : digits;
  return { country: fallback, national };
}

export function nationalDisplay(national: string, country: PhoneCountry): string {
  const digits = digitsOnly(national);
  if (digits === "") return "";
  return groupProgressive(digits, country.cc === "90" ? TR_NATIONAL_GROUPS : [3, 3, 3, 3, 3]);
}

export function formatPhone(stored: string, fallbackCountryCode: string = DEFAULT_PHONE_COUNTRY): string {
  const digits = digitsOnly(stored);
  if (digits === "") return "";
  const { country, national } = splitPhone(digits, fallbackCountryCode);
  if (national === "") return `+${country.cc}`;
  const parsed = parsePhoneNumberFromString(`+${country.cc}${national}`);
  if (parsed) return parsed.formatInternational();
  return `+${country.cc} ${nationalDisplay(national, country)}`;
}
