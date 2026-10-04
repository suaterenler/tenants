import { describe, expect, it } from "vitest";
import { fromDateKey, futurePresetRange, presetRange, toDateKey } from "./date-range";

describe("presetRange", () => {
  const now = new Date(2026, 9, 7, 15, 0);

  it("computes day, week and month presets with Monday week start", () => {
    expect(presetRange("today", now)).toEqual({ from: "2026-10-07", to: "2026-10-07" });
    expect(presetRange("yesterday", now)).toEqual({ from: "2026-10-06", to: "2026-10-06" });
    expect(presetRange("thisWeek", now)).toEqual({ from: "2026-10-05", to: "2026-10-07" });
    expect(presetRange("thisWeek", new Date(2026, 9, 4))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(presetRange("thisMonth", now)).toEqual({ from: "2026-10-01", to: "2026-10-07" });
    expect(presetRange("lastMonth", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("round-trips date keys", () => {
    expect(toDateKey(fromDateKey("2026-01-09"))).toBe("2026-01-09");
  });
});

describe("futurePresetRange", () => {
  const now = new Date(2026, 9, 4, 12, 0);

  it("covers whole week and month ahead", () => {
    expect(futurePresetRange("today", now)).toEqual({ from: "2026-10-04", to: "2026-10-04" });
    expect(futurePresetRange("thisWeek", now)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(futurePresetRange("thisWeek", new Date(2026, 9, 7))).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(futurePresetRange("thisMonth", now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(futurePresetRange("nextMonth", now)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(futurePresetRange("next30", now)).toEqual({ from: "2026-10-04", to: "2026-11-03" });
  });
});
