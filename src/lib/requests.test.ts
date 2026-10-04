import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addRequest, countNewRequests, deleteRequest, listRequests, updateRequest } from "@/server/requests";
import { bearerToken, inDateRange, findSimilarRequests, tenantLinkAllowed, type TrialRequest, companyFrom, withDefaults, columnMatches, parseInbound, parsePatch, programForProduct, programNameForProduct, resolveRequestsSecret, secretMatches, trialExpiry } from "./requests";

const valid = {
  source: "cms",
  formSlug: "deneme",
  formName: "7 Gün Ücretsiz Dene",
  submissionId: 12,
  submittedAt: "2026-10-04T10:00:00Z",
  locale: "tr",
  fields: { firma: "Güzel Saç", ad_soyad: "Ayşe Yılmaz", eposta: "ayse@example.com", telefon: "+905551112233", urun: "kuafor-programi" },
  labels: { ad_soyad: "Ad Soyad" },
  ip: "1.2.3.4",
  userAgent: "UA",
};

describe("parseInbound", () => {
  it("maps known fields", () => {
    const parsed = parseInbound(valid);
    expect(parsed).toMatchObject({ name: "Ayşe Yılmaz", email: "ayse@example.com", phone: "+905551112233", product: "kuafor-programi", submissionId: "12", ip: "1.2.3.4" });
    expect(parsed?.submittedAt).toBe("2026-10-04T10:00:00.000Z");
  });

  it("accepts string ids and null optionals", () => {
    expect(parseInbound({ ...valid, submissionId: "abc", locale: null, ip: null, userAgent: null })).toMatchObject({ submissionId: "abc", locale: null, ip: null });
  });

  it("rejects invalid bodies", () => {
    expect(parseInbound(null)).toBeNull();
    expect(parseInbound([])).toBeNull();
    expect(parseInbound({ ...valid, source: "" })).toBeNull();
    expect(parseInbound({ ...valid, submissionId: undefined })).toBeNull();
    expect(parseInbound({ ...valid, submittedAt: "nope" })).toBeNull();
    expect(parseInbound({ ...valid, fields: { a: 1 } })).toBeNull();
    expect(parseInbound({ ...valid, fields: { "bad key!": "x" } })).toBeNull();
    expect(parseInbound({ ...valid, fields: { a: "x".repeat(2001) } })).toBeNull();
  });

  it("limits field count", () => {
    const many = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`k${index}`, "v"]));
    expect(parseInbound({ ...valid, fields: many })).toBeNull();
  });
});

describe("company", () => {
  it("reads firma and fallback keys", () => {
    expect(parseInbound(valid)?.company).toBe("Güzel Saç");
    expect(companyFrom({ isletme: "X", company: "Y" })).toBe("X");
    expect(companyFrom({ firma: "  ", company: "Y" })).toBe("Y");
    expect(companyFrom({})).toBe("");
  });

  it("defaults old records to an empty company", () => {
    const old = { id: "1" } as unknown as Parameters<typeof withDefaults>[0];
    expect(withDefaults(old).company).toBe("");
  });
});

function record(overrides: Partial<TrialRequest>): TrialRequest {
  return { id: "x", receivedAt: "", source: "cms", formSlug: "f", formName: "F", submissionId: "1", submittedAt: "", locale: null, name: "", email: "", phone: "", product: "", company: "", fields: {}, labels: {}, ip: null, userAgent: null, status: "new", note: "", updatedAt: "", updatedBy: "", ...overrides };
}

describe("findSimilarRequests", () => {
  it("matches company ignoring case and Turkish characters", () => {
    const target = record({ id: "a", company: "Güzel Saç" });
    const result = findSimilarRequests(target, [target, record({ id: "b", company: "guzel sac" }), record({ id: "c", company: "Başka" })]);
    expect(result.map((item) => item.request.id)).toEqual(["b"]);
    expect(result[0].reasons).toEqual(["company"]);
  });

  it("matches email case-insensitively and phone by last ten digits", () => {
    const target = record({ id: "a", email: "Ayse@Example.com", phone: "0532 123 45 67" });
    const result = findSimilarRequests(target, [record({ id: "b", email: " ayse@example.com " }), record({ id: "c", phone: "5321234567" }), record({ id: "d", phone: "+90 532 123 45 67", email: "AYSE@example.com" })]);
    expect(result.map((item) => [item.request.id, item.reasons])).toEqual([["b", ["email"]], ["c", ["phone"]], ["d", ["email", "phone"]]]);
  });

  it("ignores empty values", () => {
    const target = record({ id: "a" });
    expect(findSimilarRequests(target, [record({ id: "b" })])).toEqual([]);
  });
});

describe("tenantLinkAllowed", () => {
  it("blocks overwriting a linked request with another tenant", () => {
    const linked = { tenantApp: "salon", tenantSlug: "demo" };
    expect(tenantLinkAllowed(linked, { tenantApp: "salon", tenantSlug: "demo" })).toBe(true);
    expect(tenantLinkAllowed(linked, { tenantApp: "salon", tenantSlug: "other" })).toBe(false);
    expect(tenantLinkAllowed(linked, { status: "trial" })).toBe(true);
    expect(tenantLinkAllowed({}, { tenantApp: "salon", tenantSlug: "x" })).toBe(true);
  });
});

describe("secret", () => {
  it("resolves TENANTS_SECRET then PLATFORM_SECRET", () => {
    expect(resolveRequestsSecret({})).toBeNull();
    expect(resolveRequestsSecret({ TENANTS_SECRET: "  " })).toBeNull();
    expect(resolveRequestsSecret({ TENANTS_SECRET: "a" })).toBe("a");
    expect(resolveRequestsSecret({ PLATFORM_SECRET: "b" })).toBe("b");
  });

  it("compares tokens", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abd", "abc")).toBe(false);
    expect(secretMatches("", "abc")).toBe(false);
    expect(bearerToken("Bearer  abc ")).toBe("abc");
    expect(bearerToken("abc")).toBe("");
    expect(bearerToken(null)).toBe("");
  });
});

describe("parsePatch", () => {
  it("validates status and note", () => {
    expect(parsePatch({ status: "trial" })).toEqual({ status: "trial" });
    expect(parsePatch({ note: "  hi " })).toEqual({ note: "hi" });
    expect(parsePatch({ status: "bogus" })).toBeNull();
    expect(parsePatch({ note: 5 })).toBeNull();
    expect(parsePatch({ other: 1 })).toBeNull();
    expect(parsePatch(null)).toBeNull();
  });

  it("accepts a linked tenant only as a complete valid set", () => {
    const tenant = { tenantApp: "salon", tenantSlug: "demo-1", tenantCreatedAt: "2026-10-04T10:00:00Z" };
    expect(parsePatch({ status: "trial", ...tenant })).toEqual({ status: "trial", ...tenant, tenantCreatedAt: "2026-10-04T10:00:00.000Z" });
    expect(parsePatch({ tenantApp: "salon", tenantSlug: "demo" })).toBeNull();
    expect(parsePatch({ ...tenant, tenantSlug: "Bad Slug" })).toBeNull();
    expect(parsePatch({ ...tenant, tenantCreatedAt: "x" })).toBeNull();
  });
});

describe("trial helpers", () => {
  it("maps products to programs", () => {
    expect(programForProduct("kuafor-programi")).toBe("salon");
    expect(programForProduct("egitim-yonetim-sistemi")).toBe("education");
    expect(programForProduct("e-ticaret")).toBe("ecommerce");
    expect(programForProduct("web-sitesi")).toBe("cms");
    expect(programForProduct("bilinmeyen")).toBe("");
    expect(programForProduct("")).toBe("");
  });

  it("names products by program list or keeps unknown values", () => {
    const programs = [{ key: "salon", name: "Salon" }, { key: "cms", name: "CMS" }];
    expect(programNameForProduct("kuafor-programi", programs)).toBe("Salon");
    expect(programNameForProduct("web-sitesi", programs)).toBe("CMS");
    expect(programNameForProduct("e-ticaret", programs)).toBe("e-ticaret");
    expect(programNameForProduct("xyz", programs)).toBe("xyz");
  });

  it("adds seven days", () => {
    expect(trialExpiry(new Date(2026, 9, 4))).toBe("2026-10-11");
    expect(trialExpiry(new Date(2026, 11, 28))).toBe("2027-01-04");
  });
});

describe("inDateRange", () => {
  const value = new Date(2026, 9, 4, 23, 30).toISOString();
  it("compares local days inclusively", () => {
    expect(inDateRange(value, "", "")).toBe(true);
    expect(inDateRange(value, "2026-10-04", "2026-10-04")).toBe(true);
    expect(inDateRange(value, "2026-10-05", "")).toBe(false);
    expect(inDateRange(value, "", "2026-10-03")).toBe(false);
    expect(inDateRange("bad", "2026-10-01", "")).toBe(false);
  });
});

describe("columnMatches", () => {
  it("matches ignoring case and Turkish characters", () => {
    expect(columnMatches("Ayşe Yılmaz", "")).toBe(true);
    expect(columnMatches("Ayşe Yılmaz", "ayse yil")).toBe(true);
    expect(columnMatches("Güzel Saç İstanbul", "GUZEL sac istanbul")).toBe(true);
    expect(columnMatches("ayse@example.com", "EXAMPLE")).toBe(true);
    expect(columnMatches("Ayşe", "zzz")).toBe(false);
  });

  it("matches phone digits across formats", () => {
    expect(columnMatches("+90 555 111 22 33", "5551112233")).toBe(true);
    expect(columnMatches("+90 555 111 22 33", "555 111")).toBe(true);
    expect(columnMatches("+90 555 111 22 33", "999")).toBe(false);
  });
});

describe("storage", () => {
  let dir = "";
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "requests-"));
    process.env.DATA_DIR = dir;
  });
  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("adds, dedupes and counts", async () => {
    const parsed = parseInbound(valid);
    if (!parsed) throw new Error("invalid");
    const first = await addRequest(parsed);
    const again = await addRequest(parsed);
    expect(first.duplicate).toBe(false);
    expect(again).toEqual({ id: first.id, duplicate: true });
    await addRequest({ ...parsed, submissionId: "13" });
    expect(await listRequests()).toHaveLength(2);
    expect(await countNewRequests()).toBe(2);
    expect(JSON.parse(await readFile(path.join(dir, "requests.json"), "utf8"))).toHaveLength(2);
  });

  it("handles concurrent writes", async () => {
    const parsed = parseInbound(valid);
    if (!parsed) throw new Error("invalid");
    await Promise.all(Array.from({ length: 20 }, (_, index) => addRequest({ ...parsed, submissionId: String(index) })));
    expect(await listRequests()).toHaveLength(20);
  });

  it("updates and deletes", async () => {
    const parsed = parseInbound(valid);
    if (!parsed) throw new Error("invalid");
    const { id } = await addRequest(parsed);
    const updated = await updateRequest(id, { status: "contacted", note: "aradım" }, "admin");
    expect(updated).toMatchObject({ status: "contacted", note: "aradım", updatedBy: "admin" });
    expect(await countNewRequests()).toBe(0);
    expect(await updateRequest("missing", { note: "x" }, "admin")).toBeNull();
    expect(await deleteRequest(id)).toBe(true);
    expect(await deleteRequest(id)).toBe(false);
    expect(await listRequests()).toHaveLength(0);
  });
});
