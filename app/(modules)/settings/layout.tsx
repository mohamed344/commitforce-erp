import SettingsHeader from "@/components/modules/settings/SettingsHeader";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SettingsHeader />
      <div className="mx-auto max-w-[1100px] p-5 sm:p-8">{children}</div>
    </div>
  );
}
