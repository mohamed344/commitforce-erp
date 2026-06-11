// CSV helpers for the CRM chiffrage pipeline (extracted from CrmProjectDetailView).
// `xlsx` is imported dynamically by callers; toCsv takes the loaded module so this
// file stays dependency-free at import time.

/** Trigger a browser download for any Blob-able payload. */
export function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build a CSV blob (UTF-8 BOM so Excel renders accents) and trigger a download. */
export function downloadCsv(csv: string, filename: string) {
  downloadBlob("﻿" + csv, filename, "text/csv;charset=utf-8");
}

/** xlsx filename from a project's code/name. */
export function xlsxName(base: string | null | undefined, suffix: string): string {
  const clean = (base || "project").replace(/[^\w.-]+/g, "_");
  return `${clean}-${suffix}.xlsx`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type XlsxLike = {
  utils: {
    aoa_to_sheet: (aoa: any[][]) => any;
    sheet_to_csv: (ws: any, opts?: { FS?: string }) => string;
  };
};

/** Array-of-arrays → CSV string with the given field separator, via xlsx. */
export function toCsv(XLSX: XlsxLike, aoa: any[][], delimiter = ";"): string {
  return XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(aoa), { FS: delimiter });
}

/** Detect the delimiter of a CSV file from its first line (French Excel uses ';'). */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
}

/** A filesystem-safe CSV name from a project's code/name. */
export function csvName(base: string | null | undefined, suffix: string): string {
  const clean = (base || "project").replace(/[^\w.-]+/g, "_");
  return `${clean}-${suffix}.csv`;
}
