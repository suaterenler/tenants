import { describe, expect, it } from "vitest";
import type { ProgramTenant } from "./apps";
import { filterTenants, paginate, parseTenantQuery, type TenantQuery } from "./tenant-query";

function tenant(overrides: Partial<ProgramTenant>): ProgramTenant {
  return { app: "education", slug: "a", name: "A", active: true, expiresAt: null, contactName: "", phone: "", email: "", disabledModules: [], domains: [], createdAt: "", ...overrides };
}

const TODAY = "2026-09-26";
const ALL = [
  tenant({ slug: "ata", name: "Ata Koleji", contactName: "Ayşe" }),
  tenant({ slug: "bil", name: "Bilgi Okulu", active: false }),
  tenant({ slug: "cag", name: "Çağ Kurs", expiresAt: "2026-09-26" }),
  tenant({ app: "salon", slug: "gul", name: "Gül Salon", expiresAt: "2026-12-01" }),
];

function query(overrides: Partial<Omit<TenantQuery, "page" | "pageSize">> = {}): Omit<TenantQuery, "page" | "pageSize"> {
  return { search: "", contact: "", expiresFrom: "", expiresTo: "", app: "", status: "", sort: "name", dir: "asc", ...overrides };
}

describe("parseTenantQuery", () => {
  it("applies safe defaults", () => {
    expect(parseTenantQuery(new URLSearchParams("page=-2&pageSize=999&status=weird&sort=bogus&dir=side"))).toEqual({ search: "", contact: "", expiresFrom: "", expiresTo: "", app: "", status: "", sort: "name", dir: "asc", page: 1, pageSize: 25 });
    expect(parseTenantQuery(new URLSearchParams("page=3&pageSize=50&status=expired&app=salon&search= x &contact= y &expiresFrom=2026-01-01&expiresTo=2026-12-31&sort=expiresAt&dir=desc"))).toEqual({ search: "x", contact: "y", expiresFrom: "2026-01-01", expiresTo: "2026-12-31", app: "salon", status: "expired", sort: "expiresAt", dir: "desc", page: 3, pageSize: 50 });
  });
});

describe("expiry date range", () => {
  const slugs = (overrides: Partial<Omit<TenantQuery, "page" | "pageSize">>) => filterTenants(ALL, query(overrides), TODAY).map((row) => row.slug);

  it("ignores invalid dates", () => {
    expect(parseTenantQuery(new URLSearchParams("expiresFrom=abc&expiresTo=2026-13-45")).expiresFrom).toBe("");
    expect(parseTenantQuery(new URLSearchParams("expiresFrom=abc&expiresTo=2026-13-45")).expiresTo).toBe("");
  });

  it("applies start, end and both inclusively and drops unlimited accounts", () => {
    expect(slugs({ expiresFrom: "2026-12-01" })).toEqual(["gul"]);
    expect(slugs({ expiresTo: "2026-09-26" })).toEqual(["cag"]);
    expect(slugs({ expiresFrom: "2026-09-26", expiresTo: "2026-12-01" })).toEqual(["cag", "gul"]);
    expect(slugs({ expiresFrom: "2027-01-01", expiresTo: "2026-01-01" })).toEqual([]);
  });
});

describe("filterTenants", () => {
  it("filters by status with expiry on its own day", () => {
    expect(filterTenants(ALL, query({ status: "active" }), TODAY).map((row) => row.slug)).toEqual(["ata", "gul"]);
    expect(filterTenants(ALL, query({ status: "passive" }), TODAY).map((row) => row.slug)).toEqual(["bil"]);
    expect(filterTenants(ALL, query({ status: "expired" }), TODAY).map((row) => row.slug)).toEqual(["cag"]);
  });

  it("filters by program and Turkish-aware search", () => {
    expect(filterTenants(ALL, query({ app: "salon" }), TODAY).map((row) => row.slug)).toEqual(["gul"]);
    expect(filterTenants(ALL, query({ contact: "AYŞE" }), TODAY).map((row) => row.slug)).toEqual(["ata"]);
  });

  it("sorts by name descending", () => {
    expect(filterTenants(ALL, query({ dir: "desc" }), TODAY).map((row) => row.slug)).toEqual(["gul", "cag", "bil", "ata"]);
  });

  it("sorts by program then name", () => {
    expect(filterTenants(ALL, query({ sort: "app" }), TODAY).map((row) => row.slug)).toEqual(["ata", "bil", "cag", "gul"]);
  });

  it("sorts by expiry date with nulls last", () => {
    expect(filterTenants(ALL, query({ sort: "expiresAt" }), TODAY).map((row) => row.slug)).toEqual(["cag", "gul", "ata", "bil"]);
    expect(filterTenants(ALL, query({ sort: "expiresAt", dir: "desc" }), TODAY).map((row) => row.slug)).toEqual(["bil", "ata", "gul", "cag"]);
  });

  it("sorts by status with active first", () => {
    expect(filterTenants(ALL, query({ sort: "status" }), TODAY).map((row) => row.slug)).toEqual(["ata", "cag", "gul", "bil"]);
  });
});

describe("paginate", () => {
  it("clamps the page into range", () => {
    expect(paginate([1, 2, 3, 4, 5], 9, 2)).toEqual({ rows: [5], page: 3, pageCount: 3 });
    expect(paginate([], 1, 25)).toEqual({ rows: [], page: 1, pageCount: 1 });
  });
});
