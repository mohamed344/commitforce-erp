import { getTranslations } from "next-intl/server";
import { getEffectiveSettings } from "@/lib/settings";
import OptionSetView from "@/components/modules/settings/OptionSetView";

export default async function ProjectsSettingsPage() {
  const s = await getEffectiveSettings();
  const t = await getTranslations("settings.sets");
  return (
    <OptionSetView
      setKey="project_status"
      isAdmin={s.isAdmin}
      title={t("project_status.title")}
      description={t("project_status.desc")}
    />
  );
}
