import { getTranslations } from "next-intl/server";
import { getEffectiveSettings } from "@/lib/settings";
import OptionSetView from "@/components/modules/settings/OptionSetView";

export default async function CrmSettingsPage() {
  const s = await getEffectiveSettings();
  const t = await getTranslations("settings.sets");
  return (
    <OptionSetView
      setKey="crm_stage"
      isAdmin={s.isAdmin}
      title={t("crm_stage.title")}
      description={t("crm_stage.desc")}
    />
  );
}
