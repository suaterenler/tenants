import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { tenantPublicAddress } = await import("./apps");

describe("tenantPublicAddress", () => {
  const pathApp = { publicUrl: null, publicPath: "/salon", hostOnly: false };
  const hostApp = { publicUrl: null, publicPath: "", hostOnly: true };

  it("alan adı varsa onu kullanır", () => {
    expect(tenantPublicAddress(pathApp, "https://app.x.com", "demo", ["merhaba.com"])).toBe("https://merhaba.com");
    expect(tenantPublicAddress(hostApp, "https://app.x.com", "demo", ["site.com"])).toBe("https://site.com");
  });

  it("alt yol programında yol adresi üretir, alan adı programında boş döner", () => {
    expect(tenantPublicAddress(pathApp, "https://app.x.com/", "demo")).toBe("https://app.x.com/salon/demo");
    expect(tenantPublicAddress(hostApp, "https://app.x.com", "demo")).toBe("");
  });
});
