"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { key: "salesInvoices", href: "/sales" },
  { key: "purchaseInvoices", href: "/sales/purchases" },
  { key: "customers", href: "/sales/customers" },
  { key: "suppliers", href: "/sales/suppliers" },
];

export default function SalesTabs() {
  const t = useTranslations("sales.tabs");
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/sales"
      ? pathname === "/sales" || (pathname.startsWith("/sales/") && !pathname.startsWith("/sales/purchases") && !pathname.startsWith("/sales/customers") && !pathname.startsWith("/sales/suppliers"))
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
