import { describe, expect, it } from "vitest";
import { normalizeDomain, parseDomains } from "./domain";

describe("normalizeDomain", () => {
  it("normalizes hostnames", () => {
    expect(normalizeDomain(" HTTPS://Salon.Merhaba.com/panel ")).toBe("salon.merhaba.com");
    expect(normalizeDomain("test.com:8080")).toBe("test.com");
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("parseDomains", () => {
  it("accepts arrays and text, dedupes", () => {
    expect(parseDomains(["merhaba.com", "Merhaba.com", "salon.merhaba.com"])).toEqual({ domains: ["merhaba.com", "salon.merhaba.com"], invalid: null });
    expect(parseDomains("merhaba.com\nsalon.merhaba.com, www.merhaba.com")).toEqual({ domains: ["merhaba.com", "salon.merhaba.com", "www.merhaba.com"], invalid: null });
  });

  it("reports the first invalid entry", () => {
    expect(parseDomains(["merhaba.com", "kötü alan"])).toEqual({ domains: [], invalid: "kötü alan" });
  });
});
