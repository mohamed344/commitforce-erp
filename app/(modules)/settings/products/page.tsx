import { getTranslations } from "next-intl/server";
import { getEffectiveSettings } from "@/lib/settings";
import OptionSetView from "@/components/modules/settings/OptionSetView";

export default async function ProductsSettingsPage() {
  const s = await getEffectiveSettings();
  const t = await getTranslations("settings.sets");
  return (
    <OptionSetView
      setKey="item_type"
      isAdmin={s.isAdmin}
      title={t("item_type.title")}
      description={t("item_type.desc")}
    />
  );
}
