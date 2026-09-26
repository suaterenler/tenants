import { describe, expect, it } from "vitest";
import type { PlatformTenant } from "./apps";
import { filterTenants, paginate, parseTenantQuery } from "./tenant-query";

function tenant(overrides: Partial<PlatformTenant>): PlatformTenant {
  return { app: "education", slug: "a", name: "A", active: true, expiresAt: null, contactName: "", phone: "", email: "", disabledModules: [], createdAt: "", ...overrides };
}

const TODAY = "2026-09-26";
const ALL = [
  tenant({ slug: "ata", name: "Ata Koleji", contactName: "Ayşe" }),
  tenant({ slug: "bil", name: "Bilgi Okulu", active: false }),
  tenant({ slug: "cag", name: "Çağ Kurs", expiresAt: "2026-09-26" }),
  tenant({ app: "salon", slug: "gul", name: "Gül Salon", expiresAt: "2026-12-01" }),
];

describe("parseTenantQuery", () => {
  it("applies safe defaults", () => {
    expect(parseTenantQuery(new URLSearchParams("page=-2&pageSize=999&status=weird"))).toEqual({ search: "", app: "", status: "", page: 1, pageSize: 25 });
    expect(parseTenantQuery(new URLSearchParams("page=3&pageSize=50&status=expired&app=salon&search= x "))).toEqual({ search: "x", app: "salon", status: "expired", page: 3, pageSize: 50 });
  });
});

describe("filterTenants", () => {
  it("filters by status with expiry on its own day", () => {
    expect(filterTenants(ALL, { search: "", app: "", status: "active" }, TODAY).map((row) => row.slug)).toEqual(["ata", "gul"]);
    expect(filterTenants(ALL, { search: "", app: "", status: "passive" }, TODAY).map((row) => row.slug)).toEqual(["bil"]);
    expect(filterTenants(ALL, { search: "", app: "", status: "expired" }, TODAY).map((row) => row.slug)).toEqual(["cag"]);
  });

  it("filters by program and Turkish-aware search", () => {
    expect(filterTenants(ALL, { search: "", app: "salon", status: "" }, TODAY).map((row) => row.slug)).toEqual(["gul"]);
    expect(filterTenants(ALL, { search: "AYŞE", app: "", status: "" }, TODAY).map((row) => row.slug)).toEqual(["ata"]);
  });
});

describe("paginate", () => {
  it("clamps the page into range", () => {
    expect(paginate([1, 2, 3, 4, 5], 9, 2)).toEqual({ rows: [5], page: 3, pageCount: 3 });
    expect(paginate([], 1, 25)).toEqual({ rows: [], page: 1, pageCount: 1 });
  });
});
