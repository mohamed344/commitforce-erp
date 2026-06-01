import { useTranslations } from "next-intl";
import { moduleByKey } from "@/config/modules";
import type { ModuleKey } from "@/lib/config";

/**
 * Placeholder workspace for a module — header (icon + title) + an
 * under-construction empty state, in the ERPNext workspace style.
 */
export default function ModuleWorkspace({ moduleKey }: { moduleKey: ModuleKey }) {
  const t = useTranslations();
  const module = moduleByKey(moduleKey);
  if (!module) return null;
  const { Icon, labelKey } = module;

  return (
    <div className="mx-auto w-full max-w-[1100px] p-5 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] bg-gradient-to-b from-brand to-brand-700 text-white shadow-[0_1px_2px_rgba(20,22,30,.08),inset_0_-1px_0_rgba(0,0,0,.08)]">
          <Icon width={28} height={28} />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold leading-tight text-ink">{t(labelKey)}</h1>
          <p className="text-[13px] text-ink-3">{t("workspace.subtitle")}</p>
        </div>
      </div>

      <div className="mt-8 grid place-items-center rounded-[16px] border border-dashed border-line bg-[#fafafb] px-6 py-16 text-center">
        <p className="text-[14px] text-ink-3">{t("workspace.comingSoon")}</p>
      </div>
    </div>
  );
}
