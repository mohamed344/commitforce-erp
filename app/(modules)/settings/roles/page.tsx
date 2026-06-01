import { getEffectiveSettings } from "@/lib/settings";
import RolesView from "@/components/modules/settings/RolesView";

export default async function RolesSettingsPage() {
  const s = await getEffectiveSettings();
  return <RolesView isAdmin={s.isAdmin} />;
}
