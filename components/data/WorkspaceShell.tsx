"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { moduleByKey } from "@/config/modules";
import type { ModuleKey } from "@/lib/config";
import ViewSwitch, { type ViewMode } from "./ViewSwitch";

export default function WorkspaceShell({
  moduleKey,
  view,
  onView,
  onNew,
  children,
}: {
  moduleKey: ModuleKey;
  view?: ViewMode;
  onView?: (v: ViewMode) => void;
  onNew: () => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  const module = moduleByKey(moduleKey)!;
  const Icon = module.Icon;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-b from-brand to-brand-700 text-white shadow-[0_1px_2px_rgba(20,22,30,.08),inset_0_-1px_0_rgba(0,0,0,.08)]">
          <Icon width={22} height={22} />
        </div>
        <h1 className="text-[20px] font-semibold text-ink">{t(module.labelKey)}</h1>
        <div className="ms-auto flex items-center gap-2">
          {view && onView && <ViewSwitch value={view} onChange={onView} />}
          <button
            type="button"
            onClick={onNew}
            className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
          >
            + {t("ui.new")}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
