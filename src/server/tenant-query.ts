import type { PlatformTenant } from "./apps";

export type TenantStatusFilter = "" | "active" | "passive" | "expired";
export type TenantQuery = { search: string; app: string; status: TenantStatusFilter; page: number; pageSize: number };

export const PAGE_SIZES = [25, 50, 100] as const;
const STATUSES = new Set<string>(["active", "passive", "expired"]);

export function todayIn(timeZone = "Europe/Istanbul", now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseTenantQuery(params: URLSearchParams): TenantQuery {
  const status = params.get("status") ?? "";
  const pageSize = positiveInt(params.get("pageSize"), PAGE_SIZES[0]);
  return {
    search: (params.get("search") ?? "").trim().slice(0, 100),
    app: (params.get("app") ?? "").trim(),
    status: (STATUSES.has(status) ? status : "") as TenantStatusFilter,
    page: positiveInt(params.get("page"), 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : PAGE_SIZES[0],
  };
}

export function isExpired(tenant: Pick<PlatformTenant, "expiresAt">, today: string): boolean {
  return tenant.expiresAt !== null && tenant.expiresAt <= today;
}

export function filterTenants(tenants: PlatformTenant[], query: Omit<TenantQuery, "page" | "pageSize">, today: string): PlatformTenant[] {
  const needle = query.search.toLocaleLowerCase("tr");
  return tenants
    .filter((tenant) => !query.app || tenant.app === query.app)
    .filter((tenant) => {
      if (query.status === "active") return tenant.active && !isExpired(tenant, today);
      if (query.status === "passive") return !tenant.active;
      if (query.status === "expired") return isExpired(tenant, today);
      return true;
    })
    .filter((tenant) => !needle || [tenant.name, tenant.slug, tenant.contactName, tenant.phone, tenant.email].some((value) => value.toLocaleLowerCase("tr").includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name, "tr") || a.slug.localeCompare(b.slug, "tr"));
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount };
}
