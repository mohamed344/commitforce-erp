import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEffectiveSettings } from "@/lib/settings";
import type { ModuleKey } from "@/lib/config";
import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require an authenticated user with an active company.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const s = await getEffectiveSettings();
  if (!s.companyId) redirect("/companies/new");

  const enabledKeys = (Object.keys(s.modules) as ModuleKey[]).filter(
    (k) => s.modules[k],
  );

  return (
    <>
      <Topbar enterprise={s.enterprise} lowStockThreshold={s.lowStockThreshold} />
      <div className="flex">
        <Sidebar enabledKeys={enabledKeys} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
