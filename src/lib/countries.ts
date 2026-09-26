export type PhoneCountry = { code: string; cc: string; flag: string; name: string; nationalMax: number };

export const DEFAULT_PHONE_COUNTRY = "TR";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "TR", cc: "90", flag: "🇹🇷", name: "Türkiye", nationalMax: 10 },
  { code: "DE", cc: "49", flag: "🇩🇪", name: "Almanya", nationalMax: 13 },
  { code: "AZ", cc: "994", flag: "🇦🇿", name: "Azerbaycan", nationalMax: 9 },
  { code: "US", cc: "1", flag: "🇺🇸", name: "ABD / Kanada", nationalMax: 10 },
  { code: "GB", cc: "44", flag: "🇬🇧", name: "Birleşik Krallık", nationalMax: 10 },
  { code: "FR", cc: "33", flag: "🇫🇷", name: "Fransa", nationalMax: 9 },
  { code: "NL", cc: "31", flag: "🇳🇱", name: "Hollanda", nationalMax: 9 },
  { code: "AT", cc: "43", flag: "🇦🇹", name: "Avusturya", nationalMax: 13 },
  { code: "BE", cc: "32", flag: "🇧🇪", name: "Belçika", nationalMax: 9 },
  { code: "CH", cc: "41", flag: "🇨🇭", name: "İsviçre", nationalMax: 9 },
  { code: "IT", cc: "39", flag: "🇮🇹", name: "İtalya", nationalMax: 10 },
  { code: "ES", cc: "34", flag: "🇪🇸", name: "İspanya", nationalMax: 9 },
  { code: "GR", cc: "30", flag: "🇬🇷", name: "Yunanistan", nationalMax: 10 },
  { code: "BG", cc: "359", flag: "🇧🇬", name: "Bulgaristan", nationalMax: 9 },
  { code: "RO", cc: "40", flag: "🇷🇴", name: "Romanya", nationalMax: 9 },
  { code: "RU", cc: "7", flag: "🇷🇺", name: "Rusya", nationalMax: 10 },
  { code: "UA", cc: "380", flag: "🇺🇦", name: "Ukrayna", nationalMax: 9 },
  { code: "PL", cc: "48", flag: "🇵🇱", name: "Polonya", nationalMax: 9 },
  { code: "SE", cc: "46", flag: "🇸🇪", name: "İsveç", nationalMax: 9 },
  { code: "NO", cc: "47", flag: "🇳🇴", name: "Norveç", nationalMax: 8 },
  { code: "DK", cc: "45", flag: "🇩🇰", name: "Danimarka", nationalMax: 8 },
  { code: "FI", cc: "358", flag: "🇫🇮", name: "Finlandiya", nationalMax: 10 },
  { code: "CY", cc: "357", flag: "🇨🇾", name: "Kıbrıs", nationalMax: 8 },
  { code: "GE", cc: "995", flag: "🇬🇪", name: "Gürcistan", nationalMax: 9 },
  { code: "KG", cc: "996", flag: "🇰🇬", name: "Kırgızistan", nationalMax: 9 },
  { code: "IR", cc: "98", flag: "🇮🇷", name: "İran", nationalMax: 10 },
  { code: "IQ", cc: "964", flag: "🇮🇶", name: "Irak", nationalMax: 10 },
  { code: "SY", cc: "963", flag: "🇸🇾", name: "Suriye", nationalMax: 9 },
  { code: "SA", cc: "966", flag: "🇸🇦", name: "S. Arabistan", nationalMax: 9 },
  { code: "AE", cc: "971", flag: "🇦🇪", name: "BAE", nationalMax: 9 },
];

const BY_CODE = new Map(PHONE_COUNTRIES.map((country) => [country.code, country]));
const BY_CC_DESC = [...PHONE_COUNTRIES].sort((a, b) => b.cc.length - a.cc.length);

export function phoneCountryOfCode(code: string): PhoneCountry {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_PHONE_COUNTRY)!;
}

export function phoneCountryOfDigits(digits: string): PhoneCountry | null {
  if (digits === "") return null;
  return BY_CC_DESC.find((country) => digits.startsWith(country.cc)) ?? null;
}

export function isPhoneCountryCode(code: string): boolean {
  return BY_CODE.has(code);
}
