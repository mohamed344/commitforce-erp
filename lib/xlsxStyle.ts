// Styled .xlsx builder for the chiffrage exports (uses xlsx-js-style, a SheetJS
// fork whose cells accept a `.s` style object — the community `xlsx` ignores it).
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DisplayStatus } from "./stockMatch";

// ARGB fill + font color per status (Excel-style "Good/Neutral/Bad" palette).
export const STATUS_STYLE: Record<DisplayStatus, { fill: string; font: string }> = {
  in_stock: { fill: "FFC6EFCE", font: "FF006100" }, // green
  insufficient: { fill: "FFFFEB9C", font: "FF9C6500" }, // amber
  not_found: { fill: "FFFFC7CE", font: "FF9C0006" }, // red
  needs_price: { fill: "FFBDD7EE", font: "FF1F4E79" }, // blue — à consulter
};

/**
 * Build a styled .xlsx (ArrayBuffer) from an array-of-arrays.
 * Row 0 is a bold header. For each data row, `statusByRow[r]` (aligned to aoa
 * rows; index 0 is the header) colors the cell at `statusCol`.
 */
export function buildStyledXlsx(
  XLSX: any,
  aoa: any[][],
  opts: { sheetName?: string; statusCol: number; statusByRow: (DisplayStatus | null)[] },
): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const ncols = aoa.reduce((m, row) => Math.max(m, row.length), 0);

  // Header row
  for (let c = 0; c < ncols; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: "FFFFFFFF" } },
        fill: { fgColor: { rgb: "FF1F6F3C" } },
        alignment: { vertical: "center", wrapText: true },
      };
    }
  }

  // Status cell color per data row
  for (let r = 1; r < aoa.length; r++) {
    const st = opts.statusByRow[r];
    if (!st) continue;
    const ref = XLSX.utils.encode_cell({ r, c: opts.statusCol });
    if (ws[ref]) {
      ws[ref].s = {
        fill: { fgColor: { rgb: STATUS_STYLE[st].fill } },
        font: { color: { rgb: STATUS_STYLE[st].font }, bold: true },
        alignment: { horizontal: "center" },
      };
    }
  }

  // Reasonable column widths
  ws["!cols"] = Array.from({ length: ncols }, (_, c) => ({ wch: c === 1 ? 38 : 14 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName ?? "QTE");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
