import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEffectiveSettings } from "@/lib/settings";
import Topbar from "@/components/dashboard/Topbar";
import ModuleGrid from "@/components/dashboard/ModuleGrid";
import StatusFooter from "@/components/dashboard/StatusFooter";

export default async function Home() {
  // Middleware guarantees an authenticated user here. If they have no active
  // company yet, send them to create one before showing the launcher.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!profile?.company_id) redirect("/companies/new");
  }

  const s = await getEffectiveSettings();

  return (
    <>
      <Topbar enterprise={s.enterprise} />
      <main className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-start px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-24 lg:pt-[120px]">
        <ModuleGrid enabled={s.modules} />
        <StatusFooter appName={s.appName} enabled={s.modules} />
      </main>
    </>
  );
}
