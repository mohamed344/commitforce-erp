import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ModuleMeta } from "@/config/modules";

const wrapper = "group flex w-[120px] flex-col items-center gap-2.5 text-center";

export default function ModuleTile({
  module,
  enabled,
}: {
  module: ModuleMeta;
  enabled: boolean;
}) {
  const t = useTranslations();
  const { Icon, labelKey, href } = module;
  const label = t(labelKey);
  const inDev = t("modules.inDevelopment");

  const inner = (
    <>
      <div
        className={`grid h-[74px] w-[74px] place-items-center rounded-[18px] text-tile-fg shadow-[0_1px_2px_rgba(20,22,30,.08),inset_0_-1px_0_rgba(0,0,0,.08)] transition-[transform,filter] duration-150 group-hover:-translate-y-px group-hover:brightness-[1.02] ${
          enabled
            ? "bg-gradient-to-b from-brand to-brand-700"
            : "bg-gradient-to-b from-tile-bg to-tile-bg-2"
        }`}
      >
        <Icon />
      </div>
      <div className="text-[14.5px] font-semibold leading-[1.2] tracking-[-0.005em] text-ink-2">
        {label}
      </div>
      {!enabled && (
        <div className="text-[11px] font-medium tracking-[0.01em] text-ink-4">
          {inDev}
        </div>
      )}
    </>
  );

  if (!enabled) {
    return (
      <div className={`${wrapper} cursor-not-allowed`} aria-disabled title={`${label} — ${inDev}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={wrapper} title={label}>
      {inner}
    </Link>
  );
}
