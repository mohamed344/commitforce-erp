import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getEffectiveSettings } from "@/lib/settings";
import OptionSetView from "@/components/modules/settings/OptionSetView";

const MASTER_LINKS = [
  { href: "/stock/item-groups", key: "groups" },
  { href: "/stock/brands", key: "brands" },
  { href: "/stock/units", key: "units" },
  { href: "/stock/attributes", key: "attributes" },
  { href: "/stock/warehouses", key: "warehouses" },
];

export default async function StockSettingsPage() {
  const s = await getEffectiveSettings();
  const t = await getTranslations("settings.sets");
  const tt = await getTranslations("stock.tabs");
  const tm = await getTranslations("settings");

  return (
    <div className="flex flex-col gap-8">
      <OptionSetView
        setKey="stock_entry_type"
        isAdmin={s.isAdmin}
        title={t("stock_entry_type.title")}
        description={t("stock_entry_type.desc")}
      />

      <div>
        <h2 className="text-[15px] font-semibold text-ink">{tm("masterData")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">{tm("masterDataDesc")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MASTER_LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13.5px] font-medium text-ink transition-colors hover:border-brand-100 hover:bg-line-2"
            >
              {tt(l.key)} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
