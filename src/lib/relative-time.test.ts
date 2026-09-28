import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = new Date("2026-09-28T12:00:00.000Z").getTime();

describe("relativeTime", () => {
  it("handles under a minute", () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe("az önce");
    expect(relativeTime(NOW + 30_000, NOW)).toBe("birazdan");
  });

  it("handles minutes only", () => {
    expect(relativeTime(NOW - 12 * 60_000, NOW)).toBe("12 dk önce");
  });

  it("combines hours and minutes", () => {
    expect(relativeTime(NOW - (60 + 5) * 60_000, NOW)).toBe("1 sa 5 dk önce");
  });

  it("combines days and hours but drops minutes", () => {
    const ms = (24 * 60 + 4 * 60 + 32) * 60_000;
    expect(relativeTime(NOW - ms, NOW)).toBe("1 gün 4 sa önce");
  });

  it("drops the second unit when it is zero", () => {
    expect(relativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2 gün önce");
  });

  it("combines months and days", () => {
    const ms = 2 * 2_629_746_000 + 3 * 86_400_000;
    expect(relativeTime(NOW - ms, NOW)).toBe("2 ay 3 gün önce");
  });

  it("combines years and months but drops smaller units", () => {
    const ms = 3 * 31_556_952_000 + 5 * 2_629_746_000 + 6 * 86_400_000 + 3 * 3_600_000;
    expect(relativeTime(NOW - ms, NOW)).toBe("3 yıl 5 ay önce");
  });

  it("reads 'sonra' for future dates", () => {
    expect(relativeTime(NOW + 2 * 86_400_000, NOW)).toBe("2 gün sonra");
    const ms = 3 * 31_556_952_000 + 5 * 2_629_746_000;
    expect(relativeTime(NOW + ms, NOW)).toBe("3 yıl 5 ay sonra");
  });

  it("supports English labels", () => {
    expect(relativeTime(NOW - 30_000, NOW, "en")).toBe("just now");
    expect(relativeTime(NOW - (60 + 5) * 60_000, NOW, "en")).toBe("1 h 5 min ago");
    expect(relativeTime(NOW + 2 * 86_400_000, NOW, "en")).toBe("in 2 d");
  });

  it("returns an empty string for invalid input", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("");
  });
});
