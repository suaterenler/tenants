const TURKISH: Record<string, string> = { ş: "s", Ş: "s", ı: "i", İ: "i", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c" };
const MAX_CODE_LENGTH = 40;

export function tenantCodeFromName(name: string): string {
  const ascii = name
    .replace(/[şŞıİğĞüÜöÖçÇ]/g, (char) => TURKISH[char] ?? char)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_CODE_LENGTH).replace(/-+$/g, "");
}

export const RESERVED_TENANT_CODES: readonly string[] = ["_next", "api", "uploads", "favicon.ico", "admin", "suspended", "notfound", "giris", "deploy"];
export const TENANT_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const TENANT_CODE_MAX = MAX_CODE_LENGTH;

export function isReservedTenantCode(code: string): boolean {
  return RESERVED_TENANT_CODES.includes(code);
}

export function isValidTenantCode(code: string): boolean {
  return TENANT_CODE_PATTERN.test(code);
}

export function uniqueTenantCode(base: string, taken: ReadonlySet<string>): string {
  if (!base) return "";
  const used = (code: string) => taken.has(code) || isReservedTenantCode(code);
  if (!used(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, MAX_CODE_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!used(candidate)) return candidate;
  }
}
