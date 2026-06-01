"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { moduleCatalog } from "@/config/modules";
import type { ModuleKey } from "@/lib/config";
import { HomeIcon } from "./icons";

/**
 * ERPNext-style left rail: Home (launcher) + the enabled modules. Icon-only on
 * small screens, icon + label from `lg`. Highlights the active route. The set of
 * enabled modules is resolved at runtime (DB > env) and passed in by the layout.
 */
export default function Sidebar({ enabledKeys }: { enabledKeys: ModuleKey[] }) {
  const t = useTranslations();
  const pathname = usePathname();
  const allow = new Set(enabledKeys);
  const enabled = moduleCatalog.filter((m) => allow.has(m.key));

  const itemCls = (active: boolean) =>
    `flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors ${
      active
        ? "bg-brand-50 font-semibold text-brand"
        : "text-ink-2 hover:bg-line-2 hover:text-ink"
    }`;

  return (
    <aside className="sticky top-16 h-[calc(100vh-64px)] w-16 shrink-0 overflow-y-auto border-e border-line-2 bg-white px-2 py-3 lg:w-60 lg:px-3">
      <Link href="/" className={itemCls(pathname === "/")} title={t("nav.home")}>
        <HomeIcon className="shrink-0" />
        <span className="hidden truncate lg:block">{t("nav.home")}</span>
      </Link>

      <div className="mt-3 hidden px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-4 lg:block">
        {t("nav.modules")}
      </div>

      <nav className="mt-1 flex flex-col gap-0.5">
        {enabled.map((m) => {
          const active = pathname === m.href || pathname.startsWith(m.href + "/");
          return (
            <Link key={m.key} href={m.href} className={itemCls(active)} title={t(m.labelKey)}>
              <m.Icon width={18} height={18} className="shrink-0" />
              <span className="hidden truncate lg:block">{t(m.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
