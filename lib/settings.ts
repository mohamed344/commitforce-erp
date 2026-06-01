/**
 * Effective settings = per-company DB overrides merged over the env defaults.
 *
 * `lib/config.ts` holds the build-time env defaults (the original IMAB design).
 * This loader reads the active company's `company_settings` row and its
 * `company_modules` toggles, and falls back to the env value for any column
 * left NULL. It is the single runtime source of truth for branding, identity,
 * localization and module visibility — components should read from here rather
 * than touching `config.*` directly.
 *
 * Server-only: it uses the cookie-based Supabase client. It never throws — if
 * the user is signed out, has no company, or the `company_settings` table does
 * not exist yet (migration 23 not applied), it returns the env defaults so the
 * shell keeps rendering exactly as before.
 */
import "server-only";
import { createClient } from "@/utils/supabase/server";
import { config, type ModuleKey } from "@/lib/config";

/** Default currency baseline (there is no env var for this today). */
export const DEFAULT_CURRENCY_FALLBACK = "DZD";

/** Default low-stock notification threshold when none is configured. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export type EffectiveSettings = {
  appName: string;
  appVersion: string;
  enterprise: { name: string; short: string; email: string; logoUrl: string };
  brand: { color: string; colorDark: string };
  font: { family: string };
  i18n: { defaultLocale: string; locales: string[] };
  /** Default currency for new price lists etc. (env has no var; baseline DZD). */
  defaultCurrency: string;
  modules: Record<ModuleKey, boolean>;
  /** Active company id, or null when signed out / no company. */
  companyId: string | null;
  /** True when the caller is an admin of the active company. */
  isAdmin: boolean;
  /** Products at/below this on-hand qty trigger the header low-stock badge. */
  lowStockThreshold: number;
};

/** Trim-or-fallback, mirroring the `str()` helper in lib/config.ts. */
function pick(value: string | null | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

/** The pure-env baseline, used whenever there is no company to read from. */
function baseline(extra: Partial<EffectiveSettings> = {}): EffectiveSettings {
  return {
    appName: config.appName,
    appVersion: config.appVersion,
    enterprise: { ...config.enterprise },
    brand: { ...config.brand },
    font: { ...config.font },
    i18n: { ...config.i18n },
    defaultCurrency: DEFAULT_CURRENCY_FALLBACK,
    // The Settings module is the control panel — always reachable.
    modules: { ...config.modules, settings: true },
    companyId: null,
    isAdmin: false,
    lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
    ...extra,
  };
}

type SettingsRow = {
  brand_color: string | null;
  brand_color_dark: string | null;
  font_family: string | null;
  app_name: string | null;
  enterprise_name: string | null;
  enterprise_short: string | null;
  enterprise_email: string | null;
  logo_url: string | null;
  default_locale: string | null;
  default_currency: string | null;
};

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return baseline();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id ?? null;
  const isAdmin = profile?.role === "admin";
  if (!companyId) return baseline({ isAdmin });

  // Settings row (single, keyed by company_id). Tolerate a missing table.
  let row: SettingsRow | null = null;
  try {
    const { data } = await supabase
      .from("company_settings")
      .select(
        "brand_color, brand_color_dark, font_family, app_name, enterprise_name, enterprise_short, enterprise_email, logo_url, default_locale, default_currency",
      )
      .eq("company_id", companyId)
      .maybeSingle();
    row = (data as SettingsRow | null) ?? null;
  } catch {
    row = null;
  }

  // Per-module toggles from company_modules (admin-managed). Tolerate missing.
  const moduleToggles = new Map<string, boolean>();
  try {
    const { data } = await supabase
      .from("company_modules")
      .select("module_key, enabled")
      .eq("company_id", companyId);
    for (const m of data ?? []) {
      moduleToggles.set(m.module_key as string, Boolean(m.enabled));
    }
  } catch {
    // ignore — fall back to env module flags
  }

  // Low-stock threshold — queried separately (own try/catch) so a missing
  // column (migration 30 not applied yet) never breaks branding/modules above.
  let lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD;
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("low_stock_threshold")
      .eq("company_id", companyId)
      .maybeSingle();
    const v = (data as { low_stock_threshold: number | null } | null)?.low_stock_threshold;
    if (v != null && v >= 0) lowStockThreshold = Number(v);
  } catch {
    // column/table missing — keep the default
  }

  const modules = {} as Record<ModuleKey, boolean>;
  for (const key of Object.keys(config.modules) as ModuleKey[]) {
    modules[key] = moduleToggles.has(key)
      ? (moduleToggles.get(key) as boolean)
      : config.modules[key];
  }
  // The Settings module is the control panel — always reachable.
  modules.settings = true;

  return {
    appName: pick(row?.app_name, config.appName),
    appVersion: config.appVersion,
    enterprise: {
      name: pick(row?.enterprise_name, config.enterprise.name),
      short: pick(row?.enterprise_short, config.enterprise.short),
      email: pick(row?.enterprise_email, config.enterprise.email),
      logoUrl: pick(row?.logo_url, config.enterprise.logoUrl),
    },
    brand: {
      color: pick(row?.brand_color, config.brand.color),
      colorDark: pick(row?.brand_color_dark, config.brand.colorDark),
    },
    font: { family: pick(row?.font_family, config.font.family) },
    i18n: {
      defaultLocale: pick(row?.default_locale, config.i18n.defaultLocale),
      locales: config.i18n.locales,
    },
    defaultCurrency: pick(row?.default_currency, DEFAULT_CURRENCY_FALLBACK),
    modules,
    companyId,
    isAdmin,
    lowStockThreshold,
  };
}
