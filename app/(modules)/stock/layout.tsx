import { getTranslations } from "next-intl/server";
import { StockIcon } from "@/components/dashboard/icons";
import StockTabs from "@/components/modules/stock/StockTabs";

export default async function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div>
      <div className="flex items-center gap-3 px-5 pt-6 sm:px-8">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-b from-brand to-brand-700 text-white shadow-[0_1px_2px_rgba(20,22,30,.08),inset_0_-1px_0_rgba(0,0,0,.08)]">
          <StockIcon width={20} height={20} />
        </div>
        <h1 className="text-[19px] font-semibold text-ink">{t("modules.stock")}</h1>
      </div>
      <div className="mt-4">
        <StockTabs />
      </div>
      <div className="mx-auto max-w-[1200px] p-5 sm:p-8">{children}</div>
    </div>
  );
}
