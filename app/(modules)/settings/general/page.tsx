import { getEffectiveSettings } from "@/lib/settings";
import SettingsForm from "@/components/modules/settings/SettingsForm";

export default async function GeneralSettingsPage() {
  const s = await getEffectiveSettings();

  return (
    <SettingsForm
      isAdmin={s.isAdmin}
      initial={{
        companyId: s.companyId,
        appName: s.appName,
        enterprise: s.enterprise,
        brand: s.brand,
        font: s.font,
        defaultLocale: s.i18n.defaultLocale,
        locales: s.i18n.locales,
        defaultCurrency: s.defaultCurrency,
        lowStockThreshold: s.lowStockThreshold,
        modules: s.modules,
      }}
    />
  );
}
