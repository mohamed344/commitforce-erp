"use client";

import { useTranslations } from "next-intl";

export type ViewMode = "list" | "board";

export default function ViewSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const t = useTranslations("ui");
  const btn = (mode: ViewMode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
        value === mode ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-[10px] border border-line bg-[#f6f6f8] p-1">
      {btn("list", t("list"))}
      {btn("board", t("board"))}
    </div>
  );
}
