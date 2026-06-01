import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import type { ModuleKey } from "@/lib/config";

export default function StatusFooter({
  appName,
  enabled,
}: {
  appName: string;
  enabled: Record<ModuleKey, boolean>;
}) {
  const t = useTranslations("footer");
  const inDevelopment = Object.values(enabled).filter((on) => !on).length;

  return (
    <div className="mt-16 flex items-center gap-2 text-[12px] text-ink-4">
      <span
        aria-hidden
        className="h-[7px] w-[7px] rounded-full bg-brand [animation:brandPulse_1.8s_infinite]"
      />
      <span>
        {appName} · v{config.appVersion} —{" "}
        {t("modulesInDevelopment", { count: inDevelopment })}
      </span>
    </div>
  );
}
