import type { ProgramTenant } from "./apps";

export type TenantStatusFilter = "" | "active" | "passive" | "expired";
export type TenantSort = "name" | "app" | "expiresAt" | "status";
export type TenantSortDir = "asc" | "desc";
export type TenantQuery = { search: string; app: string; status: TenantStatusFilter; sort: TenantSort; dir: TenantSortDir; page: number; pageSize: number };

export const PAGE_SIZES = [25, 50, 100] as const;
const STATUSES = new Set<string>(["active", "passive", "expired"]);
const SORTS = new Set<string>(["name", "app", "expiresAt", "status"]);

export function todayIn(timeZone = "Europe/Istanbul", now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseTenantQuery(params: URLSearchParams): TenantQuery {
  const status = params.get("status") ?? "";
  const sort = params.get("sort") ?? "";
  const pageSize = positiveInt(params.get("pageSize"), PAGE_SIZES[0]);
  return {
    search: (params.get("search") ?? "").trim().slice(0, 100),
    app: (params.get("app") ?? "").trim(),
    status: (STATUSES.has(status) ? status : "") as TenantStatusFilter,
    sort: (SORTS.has(sort) ? sort : "name") as TenantSort,
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    page: positiveInt(params.get("page"), 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : PAGE_SIZES[0],
  };
}

export function isExpired(tenant: Pick<ProgramTenant, "expiresAt">, today: string): boolean {
  return tenant.expiresAt !== null && tenant.expiresAt <= today;
}

const NAME_CMP = (a: ProgramTenant, b: ProgramTenant) => a.name.localeCompare(b.name, "tr") || a.slug.localeCompare(b.slug, "tr");

export function compareTenants(sort: TenantSort, dir: TenantSortDir): (a: ProgramTenant, b: ProgramTenant) => number {
  const mul = dir === "desc" ? -1 : 1;
  const comparators: Record<TenantSort, (a: ProgramTenant, b: ProgramTenant) => number> = {
    name: NAME_CMP,
    app: (a, b) => a.app.localeCompare(b.app, "tr") || NAME_CMP(a, b),
    expiresAt: (a, b) => (a.expiresAt ?? "9999-12-31").localeCompare(b.expiresAt ?? "9999-12-31") || NAME_CMP(a, b),
    status: (a, b) => Number(b.active) - Number(a.active) || NAME_CMP(a, b),
  };
  return (a, b) => mul * comparators[sort](a, b);
}

export function filterTenants(tenants: ProgramTenant[], query: Omit<TenantQuery, "page" | "pageSize">, today: string): ProgramTenant[] {
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
    .sort(compareTenants(query.sort, query.dir));
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount };
}
