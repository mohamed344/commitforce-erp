import { moduleCatalog } from "@/config/modules";
import type { ModuleKey } from "@/lib/config";
import ModuleTile from "./ModuleTile";

export default function ModuleGrid({
  enabled,
}: {
  enabled: Record<ModuleKey, boolean>;
}) {
  return (
    <section
      aria-label="Modules"
      className="flex w-full max-w-[1140px] flex-wrap justify-center gap-x-6 gap-y-7 sm:gap-x-10 sm:gap-y-9"
    >
      {moduleCatalog.map((module) => (
        <ModuleTile key={module.key} module={module} enabled={enabled[module.key]} />
      ))}
    </section>
  );
}
