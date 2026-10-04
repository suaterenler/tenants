import { describe, expect, it } from "vitest";
import { isReservedTenantCode, isValidTenantCode, tenantCodeFromName, uniqueTenantCode } from "./slug";

describe("tenantCodeFromName", () => {
  it("transliterates Turkish characters", () => {
    expect(tenantCodeFromName("Güzel Saç Stüdyosu & Ş")).toBe("guzel-sac-studyosu-s");
    expect(tenantCodeFromName("  İstanbul Kuaför  ")).toBe("istanbul-kuafor");
    expect(tenantCodeFromName("ÂLİ ÖĞRETİM Çözüm")).toBe("ali-ogretim-cozum");
  });

  it("collapses symbols and trims dashes", () => {
    expect(tenantCodeFromName("--A__B  C--")).toBe("a-b-c");
  });

  it("returns empty for blank or symbol-only input", () => {
    expect(tenantCodeFromName("")).toBe("");
    expect(tenantCodeFromName(" &&& ")).toBe("");
  });

  it("limits to 40 characters without a trailing dash", () => {
    const code = tenantCodeFromName("a".repeat(39) + " bbb");
    expect(code.length).toBeLessThanOrEqual(40);
    expect(code.endsWith("-")).toBe(false);
  });
});

describe("uniqueTenantCode", () => {
  it("keeps free codes and handles blank", () => {
    expect(uniqueTenantCode("demo", new Set())).toBe("demo");
    expect(uniqueTenantCode("", new Set(["a"]))).toBe("");
  });

  it("suffixes taken and reserved codes", () => {
    expect(uniqueTenantCode("demo", new Set(["demo"]))).toBe("demo-2");
    expect(uniqueTenantCode("demo", new Set(["demo", "demo-2"]))).toBe("demo-3");
    expect(uniqueTenantCode("admin", new Set())).toBe("admin-2");
    expect(isReservedTenantCode("api")).toBe(true);
  });

  it("shortens the base to stay within 40 characters", () => {
    const base = "a".repeat(40);
    const code = uniqueTenantCode(base, new Set([base]));
    expect(code).toBe(`${"a".repeat(38)}-2`);
    expect(isValidTenantCode(code)).toBe(true);
    const dashed = `${"a".repeat(37)}-bb`;
    expect(uniqueTenantCode(dashed, new Set([dashed])).length).toBeLessThanOrEqual(40);
  });

  it("validates code shape", () => {
    expect(isValidTenantCode("a")).toBe(true);
    expect(isValidTenantCode("-a")).toBe(false);
    expect(isValidTenantCode("a-")).toBe(false);
    expect(isValidTenantCode("a".repeat(41))).toBe(false);
  });
});
