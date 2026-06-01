"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SettingsIcon } from "@/components/dashboard/icons";

/** Settings area header: icon + title, plus a back link on every sub-page. */
export default function SettingsHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const isIndex = pathname === "/settings";

  return (
    <div className="border-b border-line-2 px-5 pt-6 pb-4 sm:px-8">
      {!isIndex && (
        <Link href="/settings" className="mb-3 inline-block text-[13px] text-ink-3 hover:text-brand">
          ← {t("settings.allSettings")}
        </Link>
      )}
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-b from-brand to-brand-700 text-white shadow-[0_1px_2px_rgba(20,22,30,.08),inset_0_-1px_0_rgba(0,0,0,.08)]">
          <SettingsIcon width={20} height={20} />
        </div>
        <h1 className="text-[19px] font-semibold text-ink">{t("modules.settings")}</h1>
      </div>
    </div>
  );
}
