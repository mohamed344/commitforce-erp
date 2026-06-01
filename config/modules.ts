import type { ComponentType, SVGProps } from "react";
import { config, type ModuleKey } from "@/lib/config";
import {
  StockIcon,
  SalesIcon,
  CrmIcon,
  ProductionIcon,
  ProjectsIcon,
  HrIcon,
  ReportsIcon,
  SettingsIcon,
} from "@/components/dashboard/icons";

export type ModuleMeta = {
  key: ModuleKey;
  /** i18n key under the `modules` namespace, e.g. modules.stock */
  labelKey: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/** A catalog entry combined with its (runtime) enabled flag. */
export type ModuleDef = ModuleMeta & { enabled: boolean };

/**
 * The ERP "workspace launcher" catalog — the green-branded equivalent of
 * ERPNext's module home. Order matches the IMAB design. Visibility is decided
 * at runtime per company (see lib/settings.ts `getEffectiveSettings().modules`),
 * falling back to the env `config.modules` defaults.
 */
export const moduleCatalog: ModuleMeta[] = [
  { key: "stock", labelKey: "modules.stock", href: "/stock", Icon: StockIcon },
  { key: "sales", labelKey: "modules.sales", href: "/sales", Icon: SalesIcon },
  { key: "crm", labelKey: "modules.crm", href: "/crm", Icon: CrmIcon },
  { key: "production", labelKey: "modules.production", href: "/production", Icon: ProductionIcon },
  { key: "projects", labelKey: "modules.projects", href: "/projects", Icon: ProjectsIcon },
  { key: "hr", labelKey: "modules.hr", href: "/hr", Icon: HrIcon },
  { key: "reports", labelKey: "modules.reports", href: "/reports", Icon: ReportsIcon },
  { key: "settings", labelKey: "modules.settings", href: "/settings", Icon: SettingsIcon },
];

/** Look up a single catalog entry by key. */
export const moduleByKey = (key: ModuleKey): ModuleMeta | undefined =>
  moduleCatalog.find((m) => m.key === key);

/**
 * Env-default enabled map. Kept for non-authenticated contexts; authenticated
 * pages should use `getEffectiveSettings().modules` instead so DB toggles win.
 */
export const defaultEnabledModules: Record<ModuleKey, boolean> = {
  ...config.modules,
  settings: true,
};
