"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  GearIcon,
  CrmIcon,
  ProjectsIcon,
  StockIcon,
  ProductionIcon,
  HrIcon,
} from "@/components/dashboard/icons";
import type { ComponentType, SVGProps } from "react";

type Card = { key: string; href: string; Icon: ComponentType<SVGProps<SVGSVGElement>> };

const CARDS: Card[] = [
  { key: "general", href: "/settings/general", Icon: GearIcon },
  { key: "crm", href: "/settings/crm", Icon: CrmIcon },
  { key: "projects", href: "/settings/projects", Icon: ProjectsIcon },
  { key: "stock", href: "/settings/stock", Icon: StockIcon },
  { key: "products", href: "/settings/products", Icon: ProductionIcon },
  { key: "roles", href: "/settings/roles", Icon: HrIcon },
];

export default function SettingsCards() {
  const t = useTranslations("settings.cards");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map(({ key, href, Icon }) => (
        <Link
          key={key}
          href={href}
          className="group flex items-start gap-3.5 rounded-[16px] border border-line bg-white p-5 transition-[border-color,box-shadow] hover:border-brand-100 hover:shadow-[0_1px_2px_rgba(20,22,30,.06)]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-gradient-to-b from-brand to-brand-700 text-white shadow-[0_1px_2px_rgba(20,22,30,.08),inset_0_-1px_0_rgba(0,0,0,.08)]">
            <Icon width={22} height={22} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink">{t(`${key}.title`)}</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{t(`${key}.desc`)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
