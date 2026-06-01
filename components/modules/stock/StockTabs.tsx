"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { key: "items", href: "/stock" },
  { key: "groups", href: "/stock/item-groups" },
  { key: "brands", href: "/stock/brands" },
  { key: "units", href: "/stock/units" },
  { key: "attributes", href: "/stock/attributes" },
  { key: "warehouses", href: "/stock/warehouses" },
  { key: "entries", href: "/stock/entries" },
  { key: "balance", href: "/stock/balance" },
];

export default function StockTabs() {
  const t = useTranslations("stock.tabs");
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/stock"
      ? pathname === "/stock" || pathname.startsWith("/stock/items")
      : pathname.startsWith(href);

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line-2 px-5 sm:px-8">
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active ? "border-brand text-brand" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
