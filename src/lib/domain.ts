const DOMAIN_PATTERN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeDomain(value: string): string | null {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return DOMAIN_PATTERN.test(host) ? host : null;
}

export function parseDomains(value: unknown): { domains: string[]; invalid: string | null } {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,]+/) : [];
  const domains: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) continue;
    const domain = normalizeDomain(item);
    if (!domain) return { domains: [], invalid: item.trim() };
    if (!domains.includes(domain)) domains.push(domain);
  }
  return { domains, invalid: null };
}
