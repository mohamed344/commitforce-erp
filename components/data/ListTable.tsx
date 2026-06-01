"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export default function ListTable<T>({
  columns,
  rows,
  getKey,
  onRowClick,
  actions,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
}) {
  const t = useTranslations("ui");

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-[14px] border border-dashed border-line bg-[#fafafb] px-6 py-16 text-center text-[14px] text-ink-3">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-line">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-[#fafafb] text-left">
            {columns.map((c, i) => (
              <th key={i} className={`px-4 py-2.5 font-semibold text-ink-3 ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
            {actions && <th className="w-px px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line-2 last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-line-2" : ""
              }`}
            >
              {columns.map((c, i) => (
                <td key={i} className={`px-4 py-3 text-ink-2 ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
              {actions && <td className="w-px whitespace-nowrap px-4 py-3">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
