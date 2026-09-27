import { describe, expect, it } from "vitest";
import { storagePhone } from "./phone";

describe("phone", () => {
  it("ülke kodu yazılarak girilen numarada kodu iki kez eklemez", () => {
    expect(storagePhone("90 532 123 45 67")).toBe("905321234567");
    expect(storagePhone(storagePhone("905321234567"))).toBe("905321234567");
    let stored = "";
    for (const key of "905321234567") {
      const national = stored.startsWith("90") ? stored.slice(2) : stored;
      stored = storagePhone(national + key);
    }
    expect(stored).toBe("905321234567");
  });
});
