export type ExcelDate = { date: Date; time: boolean };
export type ExcelCell = string | number | ExcelDate | null | undefined;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function excelDate(value: string): ExcelDate | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) return { date: new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])), time: false };
  if (!DATE_TIME.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : { date: parsed, time: true };
}

function isExcelDate(value: ExcelCell): value is ExcelDate {
  return typeof value === "object" && value !== null;
}

export function excelSerial(value: ExcelDate): number {
  const { date } = value;
  const local = value.time
    ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds())
    : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return (local - EXCEL_EPOCH) / 86_400_000;
}

type ExcelSheetOptions = {
  fileName: string;
  sheetName: string;
  header: string[];
  rows: ExcelCell[][];
  totalRow?: ExcelCell[];
};

const HEADER_FILL = "1F2937";
const HEADER_TEXT = "FFFFFF";
const ZEBRA_FILL = "E5E7EB";
const TOTAL_FILL = "D1D5DB";
const BORDER_COLOR = "9CA3AF";
const MIN_WIDTH = 8;
export const DATE_FORMAT = "dd.mm.yyyy";
export const DATE_TIME_FORMAT = "dd.mm.yyyy hh:mm:ss";
const MAX_WIDTH = 60;

const border = {
  top: { style: "thin", color: { rgb: BORDER_COLOR } },
  bottom: { style: "thin", color: { rgb: BORDER_COLOR } },
  left: { style: "thin", color: { rgb: BORDER_COLOR } },
  right: { style: "thin", color: { rgb: BORDER_COLOR } },
};

function cellWidth(value: ExcelCell): number {
  if (value === null || value === undefined) return 0;
  if (isExcelDate(value)) return value.time ? 19 : 10;
  return String(value)
    .split("\n")
    .reduce((max, line) => Math.max(max, line.length), 0);
}

export function columnWidths(header: string[], rows: ExcelCell[][]): number[] {
  return header.map((title, index) => {
    const longest = rows.reduce((max, row) => Math.max(max, cellWidth(row[index])), cellWidth(title));
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
  });
}

export function sheetName(value: string): string {
  const cleaned = value.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

export async function writeExcel({ fileName, sheetName: name, header, rows, totalRow }: ExcelSheetOptions): Promise<void> {
  const loaded = await import("xlsx-js-style");
  const XLSX = loaded.default ?? loaded;
  const body = totalRow ? [...rows, totalRow] : rows;
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body.map((row) => row.map((value) => (isExcelDate(value) ? excelSerial(value) : (value ?? ""))))]);
  const widths = columnWidths(header, body);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!rows"] = [{ hpt: 22 }];
  body.forEach((_, rowIndex) => {
    header.forEach((__, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      const cell = sheet[address] ?? (sheet[address] = { t: "s", v: "" });
      const isTotal = totalRow !== undefined && rowIndex === body.length - 1;
      const fill = isTotal ? TOTAL_FILL : rowIndex % 2 === 1 ? ZEBRA_FILL : null;
      const value = body[rowIndex]?.[columnIndex];
      const numFmt = isExcelDate(value) ? (value.time ? DATE_TIME_FORMAT : DATE_FORMAT) : null;
      if (numFmt) {
        cell.t = "n";
        cell.z = numFmt;
      }
      cell.s = {
        border,
        ...(numFmt ? { numFmt } : {}),
        alignment: { vertical: "center", wrapText: typeof cell.v === "string" && cellWidth(cell.v) > MAX_WIDTH },
        ...(fill ? { fill: { patternType: "solid", fgColor: { rgb: fill } } } : {}),
        ...(isTotal ? { font: { bold: true } } : {}),
      };
    });
  });
  header.forEach((_, columnIndex) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
    const cell = sheet[address];
    if (!cell) return;
    cell.s = {
      border,
      font: { bold: true, color: { rgb: HEADER_TEXT } },
      fill: { patternType: "solid", fgColor: { rgb: HEADER_FILL } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    };
  });
  if (header.length > 0) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName(name));
  XLSX.writeFile(book, fileName);
}
