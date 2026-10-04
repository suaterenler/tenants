import { describe, expect, it } from "vitest";
import { columnWidths, excelDate, excelSerial, sheetName } from "./excel";

describe("excel", () => {
  it("sütun genişliğini en uzun metne göre ayarlar", () => {
    expect(columnWidths(["Ad", "Telefon"], [["Ayşe Yılmaz", "+90 532 111 22 33"], ["Can", null]])).toEqual([13, 19]);
    expect(columnWidths(["No"], [[1]])).toEqual([8]);
    expect(columnWidths(["Not"], [["x".repeat(200)]])).toEqual([60]);
  });

  it("sayfa adını Excel kurallarına uydurur", () => {
    expect(sheetName("Gelir/Gider: Eylül")).toBe("Gelir Gider  Eylül");
    expect(sheetName("")).toBe("Sheet1");
    expect(sheetName("a".repeat(40))).toHaveLength(31);
  });
});

describe("excel dates", () => {
  it("tarihleri Excel tarih seri numarasına çevirir", () => {
    const dateOnly = excelDate("1990-01-31");
    expect(dateOnly?.time).toBe(false);
    expect(dateOnly && excelSerial(dateOnly)).toBe(32904);
    expect(excelDate("2026-09-27T10:30:00")?.time).toBe(true);
    expect(excelDate("Ayşe")).toBeNull();
    expect(excelDate("2026-13-99T")).toBeNull();
  });
});
